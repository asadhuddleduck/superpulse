import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

interface CheckoutBody {
  promo_code?: string;
  email?: string;
}

export async function POST(request: NextRequest) {
  let body: CheckoutBody = {};
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    // Empty body is fine — promo + email are optional.
  }

  const priceId = process.env.STRIPE_PRICE_SUPERPULSE_MONTHLY;
  if (!priceId) {
    return NextResponse.json(
      { error: "STRIPE_PRICE_SUPERPULSE_MONTHLY is not set" },
      { status: 500 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  // Optional promo code: if user typed FIRSTMONTHFREE, attach the coupon.
  const couponId = process.env.STRIPE_COUPON_FIRSTMONTHFREE;
  const userTypedPromo = (body.promo_code ?? "").trim().toUpperCase();
  const applyCoupon =
    couponId && userTypedPromo === "FIRSTMONTHFREE" ? couponId : null;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      discounts: applyCoupon ? [{ coupon: applyCoupon }] : undefined,
      payment_method_collection: "always",
      success_url: `${baseUrl}/onboarding/connect?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing`,
      automatic_tax: { enabled: true },
      customer_creation: "always",
      customer_email: body.email,
      subscription_data: {
        metadata: { source: "superpulse-direct" },
      },
      // Tax ID collection for UK businesses (lets them claim VAT).
      tax_id_collection: { enabled: true },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stripe error" },
      { status: 500 },
    );
  }
}
