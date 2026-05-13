import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { fireCapi } from "@/lib/meta-capi";
import { getClientIp, getCookieValue, getUserAgent } from "@/lib/cf-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { isAllowedOrigin } from "@/lib/origin-check";
import { isBusinessType, clampLocations } from "@/lib/business-types";
import { logServerError, mapStripeErrorToUserSafe } from "@/lib/error-mapper";

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
  audit_offer_choice?: "yes" | "no";
  event_id?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const choice = body.audit_offer_choice === "yes" ? "yes" : "no";

  const otherTicks = postsActively + hasBusinessManager + hasRunAds;
  const qualified = hasInstagram === 1 && otherTicks >= 2 ? 1 : 0;

  const waitlistRow = await db.execute({
    sql: `SELECT email, first_name, phone, instagram_handle FROM waitlist WHERE email = ?`,
    args: [email],
  });
  const wl = waitlistRow.rows[0] as
    | { email?: string; first_name?: string; phone?: string; instagram_handle?: string }
    | undefined;

  if (!wl) {
    return NextResponse.json(
      { error: "No waitlist entry for this email. Go back and join the waitlist first." },
      { status: 409 },
    );
  }

  const trustedName = (wl.first_name ?? "").toString().trim();
  const trustedPhone = (wl.phone ?? "").toString().trim();
  const trustedIg = (wl.instagram_handle ?? "").toString().trim();

  const nowIso = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO qualifier_responses
            (email, business_type, locations_count,
             has_instagram, posts_actively, has_business_manager, has_run_ads,
             qualified, audit_offer_choice, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET
            business_type = excluded.business_type,
            locations_count = excluded.locations_count,
            has_instagram = excluded.has_instagram,
            posts_actively = excluded.posts_actively,
            has_business_manager = excluded.has_business_manager,
            has_run_ads = excluded.has_run_ads,
            qualified = excluded.qualified,
            audit_offer_choice = excluded.audit_offer_choice,
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
      choice,
      nowIso,
    ],
  });

  await db.execute({
    sql: `UPDATE waitlist SET business_type = ?, locations_count = ? WHERE email = ?`,
    args: [businessType, locations, email],
  });

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

  if (choice === "no") {
    const params = new URLSearchParams({ skipped: "1" });
    if (qualified) params.set("priority", "1");
    return NextResponse.json({
      ok: true,
      qualified: !!qualified,
      redirect: `/waitlist/done?${params.toString()}`,
    });
  }

  const priceId = process.env.STRIPE_PRICE_AUDIT_27;
  if (!priceId) {
    logServerError("qualify", new Error("STRIPE_PRICE_AUDIT_27 not set"));
    return NextResponse.json({ error: "Payment setup error. Try again later." }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    logServerError("qualify", new Error("NEXT_PUBLIC_BASE_URL not set"));
    return NextResponse.json({ error: "Server config error. Try again later." }, { status: 500 });
  }

  const idempotencyKey = `qa27:${email}:${Math.floor(Date.now() / 60000)}`;

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: email,
        customer_creation: "always",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/waitlist/upsell?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/waitlist/qualify`,
        automatic_tax: { enabled: true },
        metadata: {
          product: "audit-27",
          email,
          name: trustedName,
          instagram_handle: trustedIg,
        },
        payment_intent_data: {
          setup_future_usage: "off_session",
          receipt_email: email,
          metadata: {
            product: "audit-27",
            email,
            name: trustedName,
            instagram_handle: trustedIg,
          },
        },
      },
      { idempotencyKey },
    );

    if (!session.url) {
      logServerError("qualify.session", new Error("no session url"));
      return NextResponse.json({ error: "Payment setup error. Try again." }, { status: 502 });
    }
    await fireCapi({
      event_name: "InitiateCheckout",
      event_id: `ic:${email}:${Date.now()}`,
      email,
      phone_e164: trustedPhone || undefined,
      first_name: trustedName || undefined,
      value: 27,
      currency: "GBP",
      source_url: request.headers.get("referer") || undefined,
      client_ip: getClientIp(request.headers),
      client_user_agent: getUserAgent(request.headers),
      fbp: getCookieValue(request.headers, "_fbp"),
      fbc: getCookieValue(request.headers, "_fbc"),
    });
    return NextResponse.json({
      ok: true,
      qualified: !!qualified,
      redirect: session.url,
    });
  } catch (err) {
    logServerError("qualify.stripe", err);
    const mapped = mapStripeErrorToUserSafe(err);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
