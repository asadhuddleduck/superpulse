import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { sendCapi } from "@/lib/meta-capi";

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

function toInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(1, Math.floor(v));
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.max(1, Math.floor(n));
  }
  return 1;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const name = body.name?.trim() ?? "";
  const ig = (body.instagram_handle ?? "").trim().replace(/^@/, "");
  const businessType = body.business_type?.trim() ?? "";
  const locations = toInt(body.locations_count);
  const hasInstagram = body.has_instagram ? 1 : 0;
  const postsActively = body.posts_actively ? 1 : 0;
  const hasBusinessManager = body.has_business_manager ? 1 : 0;
  const hasRunAds = body.has_run_ads ? 1 : 0;
  const choice = body.audit_offer_choice === "yes" ? "yes" : "no";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const ticks = hasInstagram + postsActively + hasBusinessManager + hasRunAds;
  const qualified = ticks >= 3 ? 1 : 0;

  await db.execute({
    sql: `INSERT INTO qualifier_responses
            (email, business_type, locations_count,
             has_instagram, posts_actively, has_business_manager, has_run_ads,
             qualified, audit_offer_choice)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      email,
      businessType || null,
      locations,
      hasInstagram,
      postsActively,
      hasBusinessManager,
      hasRunAds,
      qualified,
      choice,
    ],
  });

  await db.execute({
    sql: `UPDATE waitlist SET business_type = ?, locations_count = ? WHERE email = ?`,
    args: [businessType || null, locations, email],
  });

  const eventId = body.event_id?.trim() || `qa_${Date.now()}_${email}`;
  await sendCapi({
    event_name: "CompleteRegistration",
    event_id: eventId,
    email,
    first_name: name,
    source_url: request.headers.get("referer") || undefined,
    client_ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
    client_user_agent: request.headers.get("user-agent") || undefined,
  });

  if (choice === "no") {
    return NextResponse.json({ ok: true, qualified: !!qualified, redirect: "/waitlist/done" });
  }

  const priceId = process.env.STRIPE_PRICE_AUDIT_27;
  if (!priceId) {
    return NextResponse.json(
      { error: "STRIPE_PRICE_AUDIT_27 is not set" },
      { status: 500 },
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
      customer_creation: "always",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/waitlist/upsell?session_id={CHECKOUT_SESSION_ID}&${params.toString()}`,
      cancel_url: `${baseUrl}/waitlist/qualify?${params.toString()}`,
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      metadata: {
        product: "audit-27",
        email,
        name,
        instagram_handle: ig,
      },
      payment_intent_data: {
        setup_future_usage: "off_session",
        metadata: {
          product: "audit-27",
          email,
          name,
          instagram_handle: ig,
        },
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a URL" }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      qualified: !!qualified,
      redirect: session.url,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stripe error" },
      { status: 500 },
    );
  }
}
