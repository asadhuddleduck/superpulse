import { NextRequest, NextResponse } from "next/server";
import { getHqUserByEmail, touchHqUserLogin } from "@/lib/queries/hq-users";
import { verifyPassword, mintHqSession } from "@/lib/hq-auth";
import { logHqAction } from "@/lib/hq-audit";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// A valid scrypt hash used to equalise login work when no active account is
// found, so a real-account email can't be distinguished by response latency
// (timing-based enumeration). The salt is per-process; only the constant scrypt
// cost matters. Format must match hashPassword() so verifyPassword runs scrypt.
const DUMMY_HASH =
  "scrypt$16384$8$1$Z+4NRv2PWkIAIb01l9ycng==$1XyKc+4QJWVcyeX3gkFX0Z9w1RNcfLM9O65ZQR/7XifHL5Ld7/YLNipIWgg7tqP2TKyAbn6MqCPfFfmreoZVyA==";

function safeNext(next: string): string {
  if (next.startsWith("/admin") && !next.startsWith("//")) return next;
  return "/admin";
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? "/admin"));

  const back = (error: string) =>
    NextResponse.redirect(
      new URL(`/admin/login?error=${error}&next=${encodeURIComponent(next)}`, req.url),
      303,
    );

  if (!email || !password) return back("missing");

  // Bound online password-spray on the highest-privilege auth surface.
  const rl = await checkRateLimit("hq-login", req.headers);
  if (!rl.ok) return back("toomany");

  const user = await getHqUserByEmail(email);
  // Always run scrypt (against a dummy hash when no active account exists) so the
  // response time doesn't reveal which emails are real, then branch on a combined
  // boolean. Single generic failure for all cases — never leak which emails exist.
  const active = !!user && user.status === "active";
  const passwordOk = verifyPassword(password, active ? user!.passwordHash : DUMMY_HASH);
  if (!active || !passwordOk) {
    return back("invalid");
  }

  const { cookie } = await mintHqSession(user!.id, req.headers.get("user-agent"));
  await touchHqUserLogin(user!.id);
  await logHqAction(user!.id, "login");

  const res = NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set(cookie);
  return res;
}
