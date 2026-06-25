import { NextRequest, NextResponse } from "next/server";
import { getHqUserByEmail } from "@/lib/queries/hq-users";
import { createResetToken } from "@/lib/hq-auth";
import { sendHqResetEmail } from "@/lib/email/hq";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();

  // Always land on the same "if that email exists, we sent a link" screen —
  // never reveal whether an account exists.
  const done = NextResponse.redirect(new URL("/admin/forgot?sent=1", req.url), 303);
  if (!email) return done;

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
