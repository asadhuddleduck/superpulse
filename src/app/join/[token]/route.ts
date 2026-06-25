import { NextRequest, NextResponse } from "next/server";
import { getSignupLinkByToken, isLinkRedeemable, consumeSignupLink } from "@/lib/queries/signup-links";

export const dynamic = "force-dynamic";

function prod(): boolean {
  return process.env.NODE_ENV === "production";
}

// Redeem an HQ join link: superpulse.io/join/<token>.
//   paid    -> /pricing (coupon prefilled), attribution cookie for later
//   prepaid -> drop a comp marker cookie, send to OAuth; the FB callback flags
//              the resulting tenant comp=1 (so it survives ig-keyed tenant creation)
//   magic   -> carry the opaque token through OAuth; the callback binds the
//              target tenant ONLY to the authenticated owner of that tenant
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
    await consumeSignupLink(link.id);
    return res;
  }

  if (link.type === "prepaid") {
    const res = NextResponse.redirect(new URL("/onboarding/connect?join=prepaid", req.url));
    // Carry the link's OPAQUE token (not its guessable id). The FB OAuth
    // callback re-resolves + re-validates this link and only then sets comp=1.
    // The link is consumed there (at grant time), not here, so a click that
    // never completes OAuth doesn't burn it.
    res.cookies.set("sp_join_comp", link.token, { httpOnly: true, secure: prod(), sameSite: "lax", path: "/", maxAge: 3600 });
    return res;
  }

  if (link.type === "magic" && link.targetTenantId) {
    // SECURITY: never mint a logged-in client session from an unauthenticated
    // GET. Carry the link's OPAQUE token through Facebook OAuth (like prepaid);
    // the callback re-resolves it and binds the target tenant ONLY when the
    // person who authenticates IS that tenant (their Instagram resolves to
    // targetTenantId). A forwarded/leaked magic URL is therefore useless to
    // anyone but the intended client. The link is consumed at bind time, not here.
    const res = NextResponse.redirect(new URL("/onboarding/connect?join=magic", req.url));
    res.cookies.set("sp_join_magic", link.token, { httpOnly: true, secure: prod(), sameSite: "lax", path: "/", maxAge: 3600 });
    return res;
  }

  return NextResponse.redirect(new URL("/pricing?join=expired", req.url));
}
