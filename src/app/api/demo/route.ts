import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fireCapi } from "@/lib/meta-capi";
import { getClientIp, getCookieValue, getUserAgent } from "@/lib/cf-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { isAllowedOrigin } from "@/lib/origin-check";
import { notifySlack, escapeSlackText } from "@/lib/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email?: string;
  choice?: "yes" | "no";
  event_id?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!isAllowedOrigin(request.headers)) {
    return NextResponse.json({ error: "Bad request" }, { status: 403 });
  }

  const rl = await checkRateLimit("demo", request.headers);
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
  const choice = body.choice === "yes" ? "yes" : "no";

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

  // Demo eligibility is re-checked from the DB, never trusted from the client.
  const qRow = await db.execute({
    sql: `SELECT business_type, locations_count, demo_qualified
          FROM qualifier_responses WHERE email = ?`,
    args: [email],
  });
  const q = qRow.rows[0] as
    | {
        business_type?: string;
        locations_count?: number;
        demo_qualified?: number;
      }
    | undefined;
  if (!q || Number(q.demo_qualified) !== 1) {
    return NextResponse.json(
      { error: "Demo offer not available for this email.", redirect: "/waitlist/offer" },
      { status: 409 },
    );
  }

  const isHealthcheck = (wl.source ?? "") === "healthcheck";
  const nowIso = new Date().toISOString();

  // Always record the latest choice (a yes -> no -> yes lead must end on yes).
  await db.execute({
    sql: `UPDATE qualifier_responses SET demo_offer_choice = ?, updated_at = ? WHERE email = ?`,
    args: [choice, nowIso, email],
  });

  // Atomically claim the one-shot first opt-in: the IS NULL predicate makes
  // concurrent yes-POSTs race-safe (exactly one wins), and healthchecks never
  // consume the transition.
  let firstOptIn = false;
  if (choice === "yes" && !isHealthcheck) {
    const claim = await db.execute({
      sql: `UPDATE qualifier_responses SET demo_requested_at = ?, updated_at = ? WHERE email = ? AND demo_requested_at IS NULL`,
      args: [nowIso, nowIso, email],
    });
    firstOptIn = claim.rowsAffected > 0;
  }

  // Slack + CAPI Schedule only on the first opt-in — re-clicks and
  // back-button replays must never page the team or double-count the event.
  if (firstOptIn) {
    await notifySlack(
      `📞 SuperPulse demo request\n` +
        `*Name:* ${escapeSlackText((wl.first_name ?? "").toString().trim()) || "(unknown)"}\n` +
        `*Email:* ${escapeSlackText(email)}\n` +
        `*Phone:* ${escapeSlackText((wl.phone ?? "").toString().trim()) || "(none)"}\n` +
        `*Instagram:* @${escapeSlackText((wl.instagram_handle ?? "").toString().trim()) || "(none)"}\n` +
        `*Business type:* ${escapeSlackText((q.business_type ?? "").toString()) || "(unknown)"}\n` +
        `*Locations:* ${Number(q.locations_count ?? 0)}`,
    );

    if (body.event_id?.trim()) {
      await fireCapi({
        event_name: "Schedule",
        event_id: body.event_id.trim(),
        email,
        phone_e164: (wl.phone ?? "").toString().trim() || undefined,
        first_name: (wl.first_name ?? "").toString().trim() || undefined,
        source_url: request.headers.get("referer") || undefined,
        client_ip: getClientIp(request.headers),
        client_user_agent: getUserAgent(request.headers),
        fbp: getCookieValue(request.headers, "_fbp"),
        fbc: getCookieValue(request.headers, "_fbc"),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    first: firstOptIn,
    redirect: choice === "yes" ? "/waitlist/offer?demo=1" : "/waitlist/offer",
  });
}

// Eligibility probe for the demo page's client-side gate. Returns whether this
// email is call-eligible (3+ locations) so the page can bounce 1-2 location
// leads to /waitlist/offer BEFORE the Cal embed renders — closing the structural
// leak where a stale/direct /waitlist/demo link let a non-3+ lead book a call.
// Also returns the lead's phone so the page can prefill it onto the Cal booking.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ eligible: false, phone: "" });
  }
  const qRow = await db.execute({
    sql: `SELECT demo_qualified FROM qualifier_responses WHERE email = ?`,
    args: [email],
  });
  const eligible = Number(qRow.rows[0]?.demo_qualified ?? 0) === 1;
  let phone = "";
  if (eligible) {
    const wRow = await db.execute({
      sql: `SELECT phone FROM waitlist WHERE email = ?`,
      args: [email],
    });
    phone = (wRow.rows[0]?.phone ?? "").toString().trim();
  }
  return NextResponse.json({ eligible, phone });
}
