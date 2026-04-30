import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * One-off £90 onboarding handhold checkout. A team member gets on a call,
 * walks the user through their Business Manager + Page setup, and connects
 * SuperPulse for them. Refundable if we can't fix it.
 */
export async function POST() {
  const priceId = process.env.STRIPE_PRICE_ONBOARDING_HANDHOLD;
  if (!priceId) {
    return NextResponse.json(
      { error: "STRIPE_PRICE_ONBOARDING_HANDHOLD is not set" },
      { status: 500 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/onboarding/support?handhold=booked&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/onboarding/support`,
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      payment_intent_data: {
        metadata: { product: "onboarding-handhold" },
      },
    });

    if (session.url) return NextResponse.redirect(session.url, 303);
    return NextResponse.json({ error: "Checkout URL missing" }, { status: 500 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stripe error" },
      { status: 500 },
    );
  }
}
