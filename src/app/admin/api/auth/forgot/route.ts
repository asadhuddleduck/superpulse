import { NextRequest, NextResponse } from "next/server";
import { getHqUserByEmail } from "@/lib/queries/hq-users";
import { createResetToken } from "@/lib/hq-auth";
import { sendHqResetEmail } from "@/lib/email/hq";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();

  // Always land on the same "if that email exists, we sent a link" screen —
  // never reveal whether an account exists.
  const done = NextResponse.redirect(new URL("/admin/forgot?sent=1", req.url), 303);
  if (!email) return done;

  // Throttle per-IP and per-email so the reset endpoint can't be reset-bombed
  // (one Resend send per accepted POST). Both still land on the same screen, so
  // a rate-limited attempt is indistinguishable from a success — no enumeration.
  const ipRl = await checkRateLimit("hq-forgot", req.headers);
  if (!ipRl.ok) return done;
  const emailRl = await checkRateLimit("hq-forgot-email", req.headers, {
    identifier: email.toLowerCase(),
  });
  if (!emailRl.ok) return done;

  try {
    const user = await getHqUserByEmail(email);
    if (user && user.status !== "disabled") {
      const token = await createResetToken(user.id, "reset");
      const link = new URL(`/admin/reset?token=${token}`, req.url).toString();
      await sendHqResetEmail({ to: user.email, link });
    }
  } catch (err) {
    console.error("[hq forgot] failed", err);
  }
  return done;
}
