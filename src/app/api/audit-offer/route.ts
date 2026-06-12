import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { fireCapi } from "@/lib/meta-capi";
import { getClientIp, getCookieValue, getUserAgent } from "@/lib/cf-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { isAllowedOrigin } from "@/lib/origin-check";
import { logServerError, mapStripeErrorToUserSafe } from "@/lib/error-mapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email?: string;
  choice?: "yes" | "no";
  demo?: boolean;
  event_id?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!isAllowedOrigin(request.headers)) {
    return NextResponse.json({ error: "Bad request" }, { status: 403 });
  }

  const rl = await checkRateLimit("audit-offer", request.headers);
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

  // A qualifier row usually exists, but email deep links can reach the offer
  // page without the quiz — never block the purchase on a missing row, and
  // never INSERT one here (a zero-tick row would pollute the quiz metrics).
  const qRow = await db.execute({
    sql: `SELECT qualified, demo_requested_at FROM qualifier_responses WHERE email = ?`,
    args: [email],
  });
  const q = qRow.rows[0] as { qualified?: number; demo_requested_at?: string | null } | undefined;
  // Keyed on the write-once demo_requested_at (not the mutable choice column):
  // once a demo was requested, the contact promise stands, so the checkout
  // branch, done copy, and follow-up list can never disagree.
  const demoRequested = !!q?.demo_requested_at;

  const nowIso = new Date().toISOString();
  if (q) {
    await db.execute({
      sql: `UPDATE qualifier_responses SET audit_offer_choice = ?, updated_at = ? WHERE email = ?`,
      args: [choice, nowIso, email],
    });
  }

  if (choice === "no") {
    if (demoRequested) {
      return NextResponse.json({ ok: true, redirect: "/waitlist/done?demo=1" });
    }
    const params = new URLSearchParams({ skipped: "1" });
    if (Number(q?.qualified) === 1) params.set("priority", "1");
    return NextResponse.json({ ok: true, redirect: `/waitlist/done?${params.toString()}` });
  }

  const priceId = process.env.STRIPE_PRICE_AUDIT_27;
  if (!priceId) {
    logServerError("audit-offer", new Error("STRIPE_PRICE_AUDIT_27 not set"));
    return NextResponse.json({ error: "Payment setup error. Try again later." }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    logServerError("audit-offer", new Error("NEXT_PUBLIC_BASE_URL not set"));
    return NextResponse.json({ error: "Server config error. Try again later." }, { status: 500 });
  }

  // Branch is part of the key: same key with a different cancel_url would
  // hard-error at Stripe if the user switches pages inside the window.
  const demoFlag = demoRequested ? 1 : 0;
  const idempotencyKey = `qa27:${email}:${demoFlag}:${Math.floor(Date.now() / 60000)}`;

  const offerPath = demoRequested ? "/waitlist/offer?demo=1" : "/waitlist/offer";
  const successUrl = demoRequested
    ? `${baseUrl}/waitlist/upsell?session_id={CHECKOUT_SESSION_ID}&demo=1`
    : `${baseUrl}/waitlist/upsell?session_id={CHECKOUT_SESSION_ID}`;

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: email,
        customer_creation: "always",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: `${baseUrl}${offerPath}`,
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
      logServerError("audit-offer.session", new Error("no session url"));
      return NextResponse.json({ error: "Payment setup error. Try again." }, { status: 502 });
    }
    await fireCapi({
      event_name: "InitiateCheckout",
      event_id: body.event_id?.trim() || `ic:${email}:${Date.now()}`,
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
    return NextResponse.json({ ok: true, redirect: session.url });
  } catch (err) {
    logServerError("audit-offer.stripe", err);
    const mapped = mapStripeErrorToUserSafe(err);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
