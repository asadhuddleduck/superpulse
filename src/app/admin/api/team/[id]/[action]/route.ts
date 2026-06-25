import { NextRequest, NextResponse } from "next/server";
import { getHqUser, hasRole, createResetToken } from "@/lib/hq-auth";
import {
  getHqUserById,
  setHqUserStatus,
  setHqUserRole,
  revokeAllHqSessionsForUser,
  countActiveOwners,
  type HqRole,
} from "@/lib/queries/hq-users";
import { sendHqInviteEmail } from "@/lib/email/hq";
import { logHqAction } from "@/lib/hq-audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; action: string }> }) {
  const user = await getHqUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!(await hasRole(user, "admin"))) {
    return NextResponse.redirect(new URL("/admin/team?error=forbidden", req.url), 303);
  }

  const { id, action } = await ctx.params;
  const target = await getHqUserById(id);
  const back = (q = "") => NextResponse.redirect(new URL(`/admin/team${q}`, req.url), 303);
  if (!target) return back("?error=not_found");

  // Guard rails: only an owner can touch an owner; nobody can disable or
  // re-role themselves (a sole owner self-demoting would lock the org out with
  // no in-app recovery).
  if (target.role === "owner" && user.role !== "owner") return back("?error=forbidden");
  if (target.id === user.id && (action === "disable" || action === "role")) return back("?error=self");

  // Last-owner invariant: never let disable/demote remove the final active owner.
  const wouldDropOwner =
    target.role === "owner" &&
    (action === "disable" || (action === "role" && String((await req.clone().formData()).get("role")) !== "owner"));
  if (wouldDropOwner && (await countActiveOwners()) <= 1) return back("?error=last_owner");

  switch (action) {
    case "disable":
      await setHqUserStatus(id, "disabled");
      await revokeAllHqSessionsForUser(id);
      await logHqAction(user.id, "disable_member", { metadata: { email: target.email } });
      return back();
    case "enable":
      await setHqUserStatus(id, target.passwordHash ? "active" : "invited");
      await logHqAction(user.id, "enable_member", { metadata: { email: target.email } });
      return back();
    case "resend": {
      const token = await createResetToken(id, "invite");
      const link = new URL(`/admin/accept?token=${token}`, req.url).toString();
      try {
        await sendHqInviteEmail({ to: target.email, name: target.name, inviterName: user.name, link });
      } catch {
        /* still surface the link on the page */
      }
      return back(`?invited=${token}&to=${encodeURIComponent(target.email)}`);
    }
    case "role": {
      const form = await req.formData();
      let role = String(form.get("role") ?? "member") as HqRole;
      if (!["owner", "admin", "member"].includes(role)) role = "member";
      if (role === "owner" && user.role !== "owner") role = "admin";
      await setHqUserRole(id, role);
      await logHqAction(user.id, "change_role", { metadata: { email: target.email, role } });
      return back();
    }
    default:
      return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }
}
