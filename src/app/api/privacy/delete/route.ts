import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { isAllowedOrigin } from "@/lib/origin-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { email?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!isAllowedOrigin(request.headers)) {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 403 });
  }
  const rl = await checkRateLimit("waitlist", request.headers);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again in a moment." },
      { status: 429 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Valid email required" }, { status: 400 });
  }

  try {
    await db.execute({ sql: `DELETE FROM qualifier_responses WHERE email = ?`, args: [email] });
    await db.execute({ sql: `DELETE FROM waitlist WHERE email = ?`, args: [email] });
  } catch (err) {
    console.error("[privacy.delete]", err);
    return NextResponse.json({ ok: false, error: "Deletion failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message:
      "Lead data deleted. Note: Stripe purchase records are retained for HMRC compliance (6 years).",
  });
}
