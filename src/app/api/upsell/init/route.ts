import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { checkRateLimit } from "@/lib/rate-limit";
import { isAllowedOrigin } from "@/lib/origin-check";
import { issueUpsellToken } from "@/lib/upsell-token";
import { logServerError } from "@/lib/error-mapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "wl-upsell";
const COOKIE_MAX_AGE_SECONDS = 60 * 30;

type Body = { session_id?: string };

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

  const sessionId = body.session_id?.trim() ?? "";
  if (!sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Missing or invalid session id" }, { status: 400 });
  }

  let session: Stripe.Checkout.Session;
  try {
    session = (await stripe.checkout.sessions.retrieve(sessionId)) as Stripe.Checkout.Session;
  } catch (err) {
    logServerError("upsell-init.retrieve", err);
    return NextResponse.json({ error: "Could not verify session" }, { status: 400 });
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json({ error: "Audit not paid" }, { status: 402 });
  }
  if ((session.metadata?.product ?? "") !== "audit-27") {
    return NextResponse.json({ error: "Wrong product" }, { status: 400 });
  }

  const token = issueUpsellToken(sessionId);
  if (!token) {
    logServerError("upsell-init.token", new Error("UPSELL_HMAC_SECRET not set or too short"));
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: `${sessionId}.${token}`,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return res;
}
