import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email?: string;
  name?: string;
  instagram_handle?: string;
  parent_session_id?: string;
};

export async function POST(request: Request) {
  const priceId = process.env.STRIPE_PRICE_AUDIT_97;
  if (!priceId) {
    return NextResponse.json(
      { error: "STRIPE_PRICE_AUDIT_97 is not set" },
      { status: 500 },
    );
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
  const parentSessionId = body.parent_session_id?.trim() ?? "";

  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }
  if (!parentSessionId) {
    return NextResponse.json(
      { error: "parent_session_id required (no £27 audit found)" },
      { status: 400 },
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    (request.headers.get("origin") || "http://localhost:3000");

  try {
    const params = new URLSearchParams({ email, name, ig });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/waitlist/done?session_id={CHECKOUT_SESSION_ID}&upsell=1&${params.toString()}`,
      cancel_url: `${baseUrl}/waitlist/upsell?session_id=${parentSessionId}&${params.toString()}`,
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      metadata: {
        product: "audit-97",
        email,
        name,
        instagram_handle: ig,
        parent_session_id: parentSessionId,
      },
      payment_intent_data: {
        metadata: {
          product: "audit-97",
          email,
          name,
          instagram_handle: ig,
          parent_session_id: parentSessionId,
        },
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a URL" }, { status: 500 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stripe error" },
      { status: 500 },
    );
  }
}
