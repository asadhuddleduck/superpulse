import { NextRequest, NextResponse } from "next/server";
import { getHqUser } from "@/lib/hq-auth";
import { createSignupLink, type SignupLinkType } from "@/lib/queries/signup-links";
import { getTenantById } from "@/lib/queries/tenants";
import { logHqAction } from "@/lib/hq-audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getHqUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const form = await req.formData();
  const type = String(form.get("type") ?? "paid") as SignupLinkType;
  if (!["paid", "prepaid", "magic"].includes(type)) {
    return NextResponse.redirect(new URL("/admin/links?error=type", req.url), 303);
  }

  const label = String(form.get("label") ?? "").trim() || null;
  const email = String(form.get("email") ?? "").trim() || null;
  const stripeCoupon = String(form.get("coupon") ?? "").trim() || null;
  const targetTenantId = String(form.get("targetTenantId") ?? "").trim() || null;
  const maxUses = Math.max(1, Number(form.get("maxUses") ?? 1) || 1);
  const expiresDays = Number(form.get("expiresDays") ?? 0) || 0;
  const expiresAt =
    expiresDays > 0 ? new Date(Date.now() + expiresDays * 86400000).toISOString() : null;

  if (type === "magic" && !targetTenantId) {
    return NextResponse.redirect(new URL("/admin/links?error=magic_target", req.url), 303);
  }
  // A magic link can only bind to a tenant that has an Instagram identity (the
  // redeemer must authenticate AS that tenant). Refuse a magic link to a tenant
  // with no ig_user_id — it could never bind and would silently grant nothing.
  if (type === "magic" && targetTenantId) {
    const target = await getTenantById(targetTenantId);
    if (!target) {
      return NextResponse.redirect(new URL("/admin/links?error=magic_notfound", req.url), 303);
    }
    if (!target.igUserId) {
      return NextResponse.redirect(new URL("/admin/links?error=magic_no_ig", req.url), 303);
    }
  }

  const link = await createSignupLink({
    type,
    label,
    email,
    stripeCoupon: type === "paid" ? stripeCoupon : null,
    targetTenantId: type === "magic" ? targetTenantId : null,
    maxUses,
    expiresAt,
    createdBy: user.id,
  });
  await logHqAction(user.id, "create_link", { metadata: { type, token: link.token } });

  return NextResponse.redirect(new URL(`/admin/links?created=${link.token}`, req.url), 303);
}
