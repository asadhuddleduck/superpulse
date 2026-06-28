import { NextRequest, NextResponse } from "next/server";
import { getHqUser } from "@/lib/hq-auth";
import { revokeSignupLink, listSignupLinks } from "@/lib/queries/signup-links";
import { sendJoinLinkEmail } from "@/lib/email/hq";
import { logHqAction } from "@/lib/hq-audit";
import { publicAppOrigin } from "@/lib/ig-gate";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; action: string }> }) {
  const user = await getHqUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id, action } = await ctx.params;
  const linkId = Number(id);
  const links = await listSignupLinks();
  const link = links.find((l) => l.id === linkId);
  if (!link) return NextResponse.redirect(new URL("/admin/links?error=not_found", req.url), 303);

  if (action === "revoke") {
    await revokeSignupLink(linkId);
    await logHqAction(user.id, "revoke_link", { metadata: { token: link.token } });
    return NextResponse.redirect(new URL("/admin/links", req.url), 303);
  }

  if (action === "email") {
    if (!link.email) return NextResponse.redirect(new URL("/admin/links?error=no_email", req.url), 303);
    // Public host, never the operator console host (admin.* bounces /join to login).
    const joinUrl = `${publicAppOrigin(req.headers.get("host"))}/join/${link.token}`;
    try {
      await sendJoinLinkEmail({ to: link.email, link: joinUrl, type: link.type });
    } catch {
      return NextResponse.redirect(new URL("/admin/links?error=email_failed", req.url), 303);
    }
    return NextResponse.redirect(new URL("/admin/links?sent=1", req.url), 303);
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
