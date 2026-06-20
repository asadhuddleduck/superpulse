import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fireCapi } from "@/lib/meta-capi";
import { getClientIp, getCookieValue, getUserAgent } from "@/lib/cf-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { isAllowedOrigin } from "@/lib/origin-check";
import { isBusinessType, clampLocations } from "@/lib/business-types";
import { notifySlack, escapeSlackText } from "@/lib/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email?: string;
  name?: string;
  instagram_handle?: string;
  business_type?: string;
  locations_count?: number | string;
  has_instagram?: boolean;
  posts_actively?: boolean;
  has_business_manager?: boolean;
  has_run_ads?: boolean;
  // Sent by pre-deploy clients; ignored — the £27 choice is recorded by
  // /api/audit-offer now.
  audit_offer_choice?: "yes" | "no";
  event_id?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEMO_MIN_LOCATIONS = 3;

export async function POST(request: Request) {
  if (!isAllowedOrigin(request.headers)) {
    return NextResponse.json({ error: "Bad request" }, { status: 403 });
  }

  const rl = await checkRateLimit("qualify", request.headers);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many submissions. Try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const businessType = body.business_type?.trim() ?? "";
  if (!isBusinessType(businessType)) {
    return NextResponse.json({ error: "Invalid business type" }, { status: 400 });
  }

  const locationsCheck = clampLocations(body.locations_count);
  if (!locationsCheck.ok) {
    return NextResponse.json({ error: "Invalid number of locations" }, { status: 400 });
  }
  const locations = locationsCheck.value;

  const hasInstagram = body.has_instagram ? 1 : 0;
  const postsActively = body.posts_actively ? 1 : 0;
  const hasBusinessManager = body.has_business_manager ? 1 : 0;
  const hasRunAds = body.has_run_ads ? 1 : 0;

  // "Qualified" means call-eligible: 3+ locations (founder decision 2026-06-20 — 1-2 location
  // businesses are NOT classed as qualified). The four engagement ticks are still recorded for
  // context (INSERT below) but no longer make a 1-2 location lead "qualified".
  const demoQualified = locations >= DEMO_MIN_LOCATIONS ? 1 : 0;
  const qualified = demoQualified;

  const waitlistRow = await db.execute({
    sql: `SELECT email, first_name, phone, instagram_handle, source FROM waitlist WHERE email = ?`,
    args: [email],
  });
  const wl = waitlistRow.rows[0] as
    | { email?: string; first_name?: string; phone?: string; instagram_handle?: string; source?: string }
    | undefined;

  if (!wl) {
    return NextResponse.json(
      { error: "No waitlist entry for this email. Go back and join the waitlist first." },
      { status: 409 },
    );
  }

  const trustedName = (wl.first_name ?? "").toString().trim();
  const trustedPhone = (wl.phone ?? "").toString().trim();
  const source = (wl.source ?? "").toString().trim() || "public";

  // Re-takers (email CTAs link back to the quiz) keep their recorded demo
  // choice — never re-pitch the demo interstitial to someone who already
  // answered it.
  const prior = await db.execute({
    sql: `SELECT demo_offer_choice, demo_qualified FROM qualifier_responses WHERE email = ?`,
    args: [email],
  });
  const priorDemoChoice = (prior.rows[0]?.demo_offer_choice ?? null) as string | null;
  // Only alert on the transition into call-eligible (3+ locations). The upsert below is
  // ON CONFLICT(email), so email CTAs that link back to the quiz would otherwise re-page
  // the team every time an already-eligible lead re-takes it.
  const wasDemoQualified = prior.rows[0] ? Number(prior.rows[0].demo_qualified) === 1 : false;
  const newlyCallable = demoQualified === 1 && !wasDemoQualified;

  const nowIso = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO qualifier_responses
            (email, business_type, locations_count,
             has_instagram, posts_actively, has_business_manager, has_run_ads,
             qualified, demo_qualified, source, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET
            business_type = excluded.business_type,
            locations_count = excluded.locations_count,
            has_instagram = excluded.has_instagram,
            posts_actively = excluded.posts_actively,
            has_business_manager = excluded.has_business_manager,
            has_run_ads = excluded.has_run_ads,
            qualified = excluded.qualified,
            demo_qualified = excluded.demo_qualified,
            source = COALESCE(qualifier_responses.source, excluded.source),
            updated_at = excluded.updated_at`,
    args: [
      email,
      businessType,
      locations,
      hasInstagram,
      postsActively,
      hasBusinessManager,
      hasRunAds,
      qualified,
      demoQualified,
      source,
      nowIso,
    ],
  });

  await db.execute({
    sql: `UPDATE waitlist SET business_type = ?, locations_count = ? WHERE email = ?`,
    args: [businessType, locations, email],
  });

  // Page the team the moment a fresh lead becomes call-eligible (3+ locations) —
  // these are the multi-site owners the founder wants on a call to close.
  if (newlyCallable) {
    await notifySlack(
      `🎯 New call-eligible SuperPulse lead (3+ locations)\n` +
        `*Name:* ${escapeSlackText(trustedName) || "(unknown)"}\n` +
        `*Email:* ${escapeSlackText(email)}\n` +
        `*Phone:* ${escapeSlackText(trustedPhone) || "(none)"}\n` +
        `*Instagram:* @${escapeSlackText((wl.instagram_handle ?? "").toString().trim()) || "(none)"}\n` +
        `*Business type:* ${escapeSlackText(businessType) || "(unknown)"}\n` +
        `*Locations:* ${locations}`,
    );
  }

  if (body.event_id?.trim()) {
    await fireCapi({
      event_name: "CompleteRegistration",
      event_id: body.event_id.trim(),
      email,
      phone_e164: trustedPhone || undefined,
      first_name: trustedName || undefined,
      source_url: request.headers.get("referer") || undefined,
      client_ip: getClientIp(request.headers),
      client_user_agent: getUserAgent(request.headers),
      fbp: getCookieValue(request.headers, "_fbp"),
      fbc: getCookieValue(request.headers, "_fbc"),
    });
  }

  // Call gate is LOCATIONS (3+), not engagement (founder decision 2026-06-18): only
  // multi-site businesses (3+ locations) get to book a call; 1-2 location leads get the
  // £27 IG-review + £97 upsell ladder instead. Leads who already booked/answered the
  // call keep the call-received framing (offer?demo=1).
  let redirect: string;
  if (priorDemoChoice === "yes") {
    redirect = "/waitlist/offer?demo=1";
  } else if (demoQualified === 1) {
    redirect = "/waitlist/demo";
  } else {
    redirect = "/waitlist/offer";
  }

  return NextResponse.json({
    ok: true,
    qualified: !!qualified,
    redirect,
  });
}
