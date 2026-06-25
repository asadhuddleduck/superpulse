import { NextRequest, NextResponse } from "next/server";
import {
  verifyResetToken,
  hashPassword,
  mintHqSession,
} from "@/lib/hq-auth";
import {
  setHqUserPassword,
  markHqResetUsed,
  getHqUserById,
  revokeAllHqSessionsForUser,
} from "@/lib/queries/hq-users";
import { logHqAction } from "@/lib/hq-audit";

export const dynamic = "force-dynamic";

// Handles BOTH password reset (/admin/reset) and invite acceptance
// (/admin/accept). A valid one-time token proves identity; we set the password,
// kill any other sessions for that user, and sign them in.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  // The page the request came from, so errors return to the right screen.
  const formPath = String(form.get("path") ?? "/admin/reset");
  const path = formPath === "/admin/accept" ? "/admin/accept" : "/admin/reset";

  const back = (error: string) =>
    NextResponse.redirect(
      new URL(`${path}?token=${encodeURIComponent(token)}&error=${error}`, req.url),
      303,
    );

  if (password.length < 8) return back("weak");

  const rec = await verifyResetToken(token);
  if (!rec) return back("invalid");

  const user = await getHqUserById(rec.userId);
  if (!user || user.status === "disabled") return back("invalid");

  await setHqUserPassword(user.id, hashPassword(password)); // also flips status -> active
  await markHqResetUsed(rec.tokenHash);
  await revokeAllHqSessionsForUser(user.id); // any prior sessions die on a password change

  const { cookie } = await mintHqSession(user.id, req.headers.get("user-agent"));
  await logHqAction(user.id, rec.purpose === "invite" ? "login" : "login");

  const res = NextResponse.redirect(new URL("/admin", req.url), 303);
  res.cookies.set(cookie);
  return res;
}
