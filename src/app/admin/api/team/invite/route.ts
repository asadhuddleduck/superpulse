import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getHqUser, hasRole, createResetToken } from "@/lib/hq-auth";
import { getHqUserByEmail, createHqUser, type HqRole } from "@/lib/queries/hq-users";
import { sendHqInviteEmail } from "@/lib/email/hq";
import { logHqAction } from "@/lib/hq-audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getHqUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!(await hasRole(user, "admin"))) {
    return NextResponse.redirect(new URL("/admin/team?error=forbidden", req.url), 303);
  }

  const form = await req.formData();
  const email = String(form.get("email") ?? "").toLowerCase().trim();
  const name = String(form.get("name") ?? "").trim() || null;
  let role = String(form.get("role") ?? "member") as HqRole;
  if (!["owner", "admin", "member"].includes(role)) role = "member";
  // Only an owner can mint another owner.
  if (role === "owner" && user.role !== "owner") role = "admin";

  if (!email) return NextResponse.redirect(new URL("/admin/team?error=missing", req.url), 303);
  if (await getHqUserByEmail(email)) {
    return NextResponse.redirect(new URL("/admin/team?error=exists", req.url), 303);
  }

  const id = `hqu_${randomBytes(8).toString("hex")}`;
  await createHqUser({ id, email, name, role, status: "invited", invitedBy: user.id });
  const token = await createResetToken(id, "invite");
  const link = new URL(`/admin/accept?token=${token}`, req.url).toString();

  try {
    await sendHqInviteEmail({ to: email, name, inviterName: user.name, link });
  } catch {
    // Email may fail (e.g. RESEND not set in dev) — the page still shows the link.
  }
  await logHqAction(user.id, "invite_member", { metadata: { email, role } });

  return NextResponse.redirect(new URL(`/admin/team?invited=${token}&to=${encodeURIComponent(email)}`, req.url), 303);
}
