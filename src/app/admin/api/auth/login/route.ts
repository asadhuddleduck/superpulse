import { NextRequest, NextResponse } from "next/server";
import { getHqUserByEmail, touchHqUserLogin } from "@/lib/queries/hq-users";
import { verifyPassword, mintHqSession } from "@/lib/hq-auth";
import { logHqAction } from "@/lib/hq-audit";

export const dynamic = "force-dynamic";

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

  const user = await getHqUserByEmail(email);
  // Single generic failure for all cases (no account / wrong password / disabled
  // / invite-not-accepted) so we never leak which emails exist.
  if (!user || user.status !== "active" || !verifyPassword(password, user.passwordHash)) {
    return back("invalid");
  }

  const { cookie } = await mintHqSession(user.id, req.headers.get("user-agent"));
  await touchHqUserLogin(user.id);
  await logHqAction(user.id, "login");

  const res = NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set(cookie);
  return res;
}
