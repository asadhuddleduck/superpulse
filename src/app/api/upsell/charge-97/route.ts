import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { sendCapi } from "@/lib/meta-capi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  parent_session_id?: string;
  email?: string;
  name?: string;
  instagram_handle?: string;
};

const AMOUNT_PENNIES = 9700;
const CURRENCY = "gbp";

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const parentSessionId = body.parent_session_id?.trim() ?? "";
  const emailFromBody = body.email?.trim().toLowerCase() ?? "";
  const nameFromBody = body.name?.trim() ?? "";
  const igFromBody = (body.instagram_handle ?? "").trim().replace(/^@/, "");

  if (!parentSessionId) {
    return NextResponse.json(
      { error: "parent_session_id required" },
      { status: 400 },
    );
  }

  let parent: Stripe.Checkout.Session;
  try {
    parent = await stripe.checkout.sessions.retrieve(parentSessionId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not fetch parent session" },
      { status: 400 },
    );
  }

  if (parent.payment_status !== "paid") {
    return NextResponse.json(
      { error: "Parent £27 audit not paid" },
      { status: 402 },
    );
  }

  const customerId =
    typeof parent.customer === "string"
      ? parent.customer
      : (parent.customer?.id ?? null);

  if (!customerId) {
    return NextResponse.json(
      { error: "No customer on parent session — card cannot be reused" },
      { status: 422 },
    );
  }

  const email = (
    emailFromBody ||
    parent.customer_details?.email ||
    parent.customer_email ||
    ""
  ).toLowerCase();
  const name = nameFromBody || parent.customer_details?.name || "";
  const ig = igFromBody || (parent.metadata?.instagram_handle ?? "");

  const methods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 1,
  });
  const paymentMethodId = methods.data[0]?.id;

  if (!paymentMethodId) {
    return NextResponse.json(
      { error: "No saved card on file for this customer" },
      { status: 422 },
    );
  }

  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create({
      amount: AMOUNT_PENNIES,
      currency: CURRENCY,
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description: "SuperPulse audit Loom walkthrough (£97)",
      metadata: {
        product: "audit-97",
        email,
        name,
        instagram_handle: ig,
        parent_session_id: parentSessionId,
      },
    });
  } catch (err) {
    const stripeErr = err as {
      type?: string;
      code?: string;
      message?: string;
      payment_intent?: { id?: string };
    };
    if (stripeErr?.type === "StripeCardError" && stripeErr.payment_intent?.id) {
      return NextResponse.json(
        {
          error: stripeErr.message || "Card declined",
          payment_intent_id: stripeErr.payment_intent.id,
          requires_action: stripeErr.code === "authentication_required",
        },
        { status: 402 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stripe error" },
      { status: 500 },
    );
  }

  if (intent.status !== "succeeded") {
    return NextResponse.json(
      {
        error: `Payment ${intent.status}`,
        payment_intent_id: intent.id,
        requires_action: intent.status === "requires_action",
      },
      { status: 402 },
    );
  }

  await db.execute({
    sql: `INSERT INTO audit_purchases
            (stripe_session_id, stripe_payment_intent_id, stripe_customer_id,
             email, name, phone, instagram_handle, tier, amount_total, currency,
             parent_session_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(stripe_session_id) DO NOTHING`,
    args: [
      intent.id,
      intent.id,
      customerId,
      email,
      name || null,
      parent.customer_details?.phone || null,
      ig || null,
      "audit-97",
      AMOUNT_PENNIES,
      CURRENCY,
      parentSessionId,
    ],
  });

  await sendCapi({
    event_name: "Purchase",
    event_id: intent.id,
    email,
    first_name: name,
    value: AMOUNT_PENNIES / 100,
    currency: CURRENCY.toUpperCase(),
    source_url: request.headers.get("referer") || undefined,
    client_ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
    client_user_agent: request.headers.get("user-agent") || undefined,
  });

  const params = new URLSearchParams({
    session_id: parentSessionId,
    upsell: "1",
    email,
    name,
    ig,
  });
  return NextResponse.json({
    ok: true,
    payment_intent_id: intent.id,
    redirect: `/waitlist/done?${params.toString()}`,
  });
}
