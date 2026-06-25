import { NextRequest, NextResponse } from "next/server";
import { getSignupLinkByToken, isLinkRedeemable, recordLinkUse } from "@/lib/queries/signup-links";

export const dynamic = "force-dynamic";

const SIXTY_DAYS = 60 * 60 * 24 * 60;

function prod(): boolean {
  return process.env.NODE_ENV === "production";
}

// Redeem an HQ join link: superpulse.io/join/<token>.
//   paid    -> /pricing (coupon prefilled), attribution cookie for later
//   prepaid -> drop a comp marker cookie, send to OAuth; the FB callback flags
//              the resulting tenant comp=1 (so it survives ig-keyed tenant creation)
//   magic   -> bind the existing target tenant and resume onboarding
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const link = await getSignupLinkByToken(token);

  if (!link || !isLinkRedeemable(link)) {
    return NextResponse.redirect(new URL("/pricing?join=expired", req.url));
  }

  if (link.type === "paid") {
    const url = new URL("/pricing", req.url);
    if (link.stripeCoupon) url.searchParams.set("promo", link.stripeCoupon);
    const res = NextResponse.redirect(url);
    res.cookies.set("sp_join", String(link.id), { httpOnly: true, secure: prod(), sameSite: "lax", path: "/", maxAge: 3600 });
    await recordLinkUse(link.id);
    return res;
  }

  if (link.type === "prepaid") {
    const res = NextResponse.redirect(new URL("/onboarding/connect?join=prepaid", req.url));
    // The FB OAuth callback reads this and sets comp=1 + signup_link_id on the
    // tenant it creates/updates, so comped access survives ig-keyed tenant IDs.
    res.cookies.set("sp_join_comp", String(link.id), { httpOnly: true, secure: prod(), sameSite: "lax", path: "/", maxAge: 3600 });
    await recordLinkUse(link.id);
    return res;
  }

  if (link.type === "magic" && link.targetTenantId) {
    const res = NextResponse.redirect(new URL("/dashboard", req.url));
    res.cookies.set("tenant_id", link.targetTenantId, {
      httpOnly: true,
      secure: prod(),
      sameSite: "lax",
      path: "/",
      maxAge: SIXTY_DAYS,
    });
    await recordLinkUse(link.id);
    return res;
  }

  return NextResponse.redirect(new URL("/pricing?join=expired", req.url));
}
