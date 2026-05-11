import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { logServerError, mapStripeErrorToUserSafe } from "@/lib/error-mapper";
import { isAllowedOrigin } from "@/lib/origin-check";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { email?: string; name?: string; instagram_handle?: string };

export async function POST(request: Request) {
  if (!isAllowedOrigin(request.headers)) {
    return NextResponse.json({ error: "Bad request" }, { status: 403 });
  }
  const rl = await checkRateLimit("qualify", request.headers);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const priceId = process.env.STRIPE_PRICE_AUDIT_27;
  if (!priceId) {
    logServerError("audit-27", new Error("STRIPE_PRICE_AUDIT_27 not set"));
    return NextResponse.json({ error: "Payment setup error." }, { status: 500 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const name = body.name?.trim() ?? "";
  const ig = (body.instagram_handle ?? "").trim().replace(/^@/, "");

  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    logServerError("audit-27", new Error("NEXT_PUBLIC_BASE_URL not set"));
    return NextResponse.json({ error: "Server config error." }, { status: 500 });
  }

  const idempotencyKey = `cs27:${email}:${Math.floor(Date.now() / 60000)}`;

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: email,
        customer_creation: "always",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/waitlist/upsell?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/waitlist`,
        automatic_tax: { enabled: true },
        metadata: {
          product: "audit-27",
          email,
          name,
          instagram_handle: ig,
        },
        payment_intent_data: {
          setup_future_usage: "off_session",
          receipt_email: email,
          metadata: {
            product: "audit-27",
            email,
            name,
            instagram_handle: ig,
          },
        },
      },
      { idempotencyKey },
    );
    if (!session.url) {
      return NextResponse.json({ error: "Payment setup error." }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    logServerError("audit-27", err);
    const mapped = mapStripeErrorToUserSafe(err);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
