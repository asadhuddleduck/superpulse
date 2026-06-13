import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { fireCapi } from "@/lib/meta-capi";
import { getClientIp, getCookieValue, getUserAgent } from "@/lib/cf-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { isAllowedOrigin } from "@/lib/origin-check";
import { verifyUpsellToken } from "@/lib/upsell-token";
import { logServerError, mapStripeErrorToUserSafe } from "@/lib/error-mapper";
import { sendAuditConfirmation } from "@/lib/email/confirmation";

const UPSELL_COOKIE = "wl-upsell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  parent_session_id?: string;
};

const CURRENCY = "gbp";

async function resolveAmount(): Promise<number> {
  const priceId = process.env.STRIPE_PRICE_AUDIT_97;
  if (!priceId) return 9700;
  try {
    const price = await stripe.prices.retrieve(priceId);
    if (typeof price.unit_amount === "number" && price.unit_amount > 0) {
      return price.unit_amount;
    }
  } catch (err) {
    logServerError("charge-97.price", err);
  }
  return 9700;
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request.headers)) {
    return NextResponse.json({ error: "Bad request" }, { status: 403 });
  }

  const rl = await checkRateLimit("upsell", request.headers);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const parentSessionId = body.parent_session_id?.trim() ?? "";
  if (!parentSessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Missing or invalid session id" }, { status: 400 });
  }

  const cookieRaw = getCookieValue(request.headers, UPSELL_COOKIE) ?? "";
  const [cookieSessionId, cookieToken] = cookieRaw.split(".", 2);
  if (
    !cookieSessionId ||
    !cookieToken ||
    cookieSessionId !== parentSessionId ||
    !verifyUpsellToken(parentSessionId, cookieToken)
  ) {
    return NextResponse.json({ error: "Session not verified. Reload and try again." }, { status: 403 });
  }

  const existing = await db.execute({
    sql: `SELECT id, stripe_payment_intent_id FROM audit_purchases
          WHERE parent_session_id = ? AND tier = 'audit-97' LIMIT 1`,
    args: [parentSessionId],
  });
  if (existing.rows[0]) {
    return NextResponse.json({
      ok: true,
      already_purchased: true,
      redirect: `/waitlist/done?session_id=${parentSessionId}&upsell=1`,
    });
  }

  const parentRefundCheck = await db.execute({
    sql: `SELECT refunded FROM audit_purchases WHERE stripe_session_id = ? LIMIT 1`,
    args: [parentSessionId],
  });
  const parentRefundedRow = parentRefundCheck.rows[0] as { refunded?: number } | undefined;
  if (parentRefundedRow && Number(parentRefundedRow.refunded) === 1) {
    return NextResponse.json(
      { error: "The original £27 audit was refunded. Get in touch if this is unexpected." },
      { status: 409 },
    );
  }

  let parent: Stripe.Checkout.Session;
  try {
    parent = (await stripe.checkout.sessions.retrieve(parentSessionId, {
      expand: ["payment_intent.payment_method", "customer"],
    })) as Stripe.Checkout.Session;
  } catch (err) {
    logServerError("charge-97.parent", err);
    return NextResponse.json({ error: "Could not verify the £27 audit." }, { status: 400 });
  }

  if (parent.payment_status !== "paid") {
    return NextResponse.json({ error: "£27 audit not paid." }, { status: 402 });
  }

  const parentPi = parent.payment_intent as Stripe.PaymentIntent | string | null;
  const parentPiObj = typeof parentPi === "string" ? null : parentPi;

  const customerId =
    typeof parent.customer === "string" ? parent.customer : parent.customer?.id ?? null;
  if (!customerId) {
    return NextResponse.json(
      { error: "Card cannot be reused for this order." },
      { status: 422 },
    );
  }

  const paymentMethodFromParent =
    parentPiObj && parentPiObj.payment_method
      ? typeof parentPiObj.payment_method === "string"
        ? parentPiObj.payment_method
        : parentPiObj.payment_method.id
      : null;

  let paymentMethodId = paymentMethodFromParent;
  if (!paymentMethodId) {
    try {
      const methods = await stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
        limit: 1,
      });
      paymentMethodId = methods.data[0]?.id ?? null;
    } catch (err) {
      logServerError("charge-97.pmlist", err);
    }
  }

  const email = (
    parent.customer_details?.email ||
    parent.customer_email ||
    parent.metadata?.email ||
    ""
  ).toString().trim().toLowerCase();
  const name = (parent.customer_details?.name || parent.metadata?.name || "").toString().trim();
  const ig = (parent.metadata?.instagram_handle || "").toString().trim();

  let phoneE164: string | undefined;
  if (email) {
    try {
      const wl = await db.execute({
        sql: `SELECT phone FROM waitlist WHERE email = ? LIMIT 1`,
        args: [email],
      });
      const row = wl.rows[0] as { phone?: string } | undefined;
      if (row?.phone) phoneE164 = row.phone;
    } catch {
      /* not critical */
    }
  }

  const amountPennies = await resolveAmount();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    logServerError("charge-97", new Error("NEXT_PUBLIC_BASE_URL not set"));
    return NextResponse.json({ error: "Server config error. Try again later." }, { status: 500 });
  }

  // Demo state is derived server-side (write-once demo_requested_at) so the
  // 3DS fallback's Stripe-hosted URLs keep the demo line on the done page.
  let demoRequested = false;
  if (email) {
    try {
      const dr = await db.execute({
        sql: `SELECT demo_requested_at FROM qualifier_responses WHERE email = ? LIMIT 1`,
        args: [email],
      });
      demoRequested = !!(dr.rows[0] as { demo_requested_at?: string | null } | undefined)?.demo_requested_at;
    } catch {
      /* not critical — worst case the done page drops the demo copy line */
    }
  }

  if (!paymentMethodId) {
    return await fallbackToCheckout(
      parentSessionId,
      customerId,
      email,
      name,
      ig,
      amountPennies,
      baseUrl,
      demoRequested,
    );
  }

  const idempotencyKey = `oneclick:${parentSessionId}`;

  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create(
      {
        amount: amountPennies,
        currency: CURRENCY,
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        receipt_email: email || undefined,
        description: "SuperPulse audit Loom walkthrough",
        metadata: {
          product: "audit-97",
          email,
          name,
          instagram_handle: ig,
          parent_session_id: parentSessionId,
        },
      },
      { idempotencyKey },
    );
  } catch (err) {
    const stripeErr = err as {
      type?: string;
      code?: string;
      message?: string;
      payment_intent?: { id?: string };
    };
    if (
      stripeErr?.type === "StripeCardError" &&
      stripeErr.code === "authentication_required"
    ) {
      return await fallbackToCheckout(
        parentSessionId,
        customerId,
        email,
        name,
        ig,
        amountPennies,
        baseUrl,
        demoRequested,
      );
    }
    logServerError("charge-97.confirm", err);
    const mapped = mapStripeErrorToUserSafe(err);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }

  if (intent.status === "requires_action") {
    return await fallbackToCheckout(
      parentSessionId,
      customerId,
      email,
      name,
      ig,
      amountPennies,
      baseUrl,
      demoRequested,
    );
  }

  if (intent.status !== "succeeded") {
    logServerError("charge-97.status", new Error(`unexpected status ${intent.status}`));
    return NextResponse.json(
      { error: `Payment ${intent.status}. Try again.` },
      { status: 402 },
    );
  }

  const oneclickIns = await db.execute({
    sql: `INSERT INTO audit_purchases
            (stripe_session_id, stripe_payment_intent_id, stripe_customer_id,
             email, name, phone, instagram_handle, tier, amount_total, currency,
             parent_session_id, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'audit-97', ?, ?, ?, 'oneclick')
          ON CONFLICT(stripe_session_id) DO NOTHING`,
    args: [
      `oneclick:${intent.id}`,
      intent.id,
      customerId,
      email,
      name || null,
      phoneE164 || null,
      ig || null,
      intent.amount_received ?? amountPennies,
      CURRENCY,
      parentSessionId,
    ],
  });

  await fireCapi({
    event_name: "Purchase",
    event_id: intent.id,
    email,
    phone_e164: phoneE164,
    first_name: name || undefined,
    value: (intent.amount_received ?? amountPennies) / 100,
    currency: CURRENCY.toUpperCase(),
    source_url: request.headers.get("referer") || undefined,
    client_ip: getClientIp(request.headers),
    client_user_agent: getUserAgent(request.headers),
    fbp: getCookieValue(request.headers, "_fbp"),
    fbc: getCookieValue(request.headers, "_fbc"),
  });

  if (oneclickIns.rowsAffected > 0 && email) {
    void sendAuditConfirmation(email, name.split(" ")[0] ?? "", "audit-97");
  }

  return NextResponse.json({
    ok: true,
    payment_intent_id: intent.id,
    redirect: `/waitlist/done?session_id=${parentSessionId}&upsell=1&pi=${intent.id}`,
  });
}

async function fallbackToCheckout(
  parentSessionId: string,
  customerId: string,
  email: string,
  name: string,
  ig: string,
  amountPennies: number,
  baseUrl: string,
  demoRequested: boolean,
): Promise<NextResponse> {
  const priceId = process.env.STRIPE_PRICE_AUDIT_97;
  if (!priceId) {
    logServerError("charge-97.fallback", new Error("STRIPE_PRICE_AUDIT_97 not set"));
    return NextResponse.json({ error: "Payment setup error." }, { status: 500 });
  }

  const demoParam = demoRequested ? "&demo=1" : "";
  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/waitlist/done?session_id=${parentSessionId}&upsell=1${demoParam}&cs={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/waitlist/upsell?session_id=${parentSessionId}${demoParam}`,
        automatic_tax: { enabled: true },
        metadata: {
          product: "audit-97",
          email,
          name,
          instagram_handle: ig,
          parent_session_id: parentSessionId,
        },
        payment_intent_data: {
          receipt_email: email || undefined,
          metadata: {
            product: "audit-97",
            email,
            name,
            instagram_handle: ig,
            parent_session_id: parentSessionId,
          },
        },
      },
      // Branch in the key: same key with different URLs hard-errors at Stripe.
      { idempotencyKey: `fb97:${parentSessionId}:${demoRequested ? 1 : 0}` },
    );
    if (!session.url) {
      return NextResponse.json({ error: "Payment setup error." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, requires_action: true, redirect: session.url, amount: amountPennies });
  } catch (err) {
    logServerError("charge-97.fallback", err);
    const mapped = mapStripeErrorToUserSafe(err);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
