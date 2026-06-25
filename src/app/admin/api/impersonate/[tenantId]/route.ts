import { NextRequest, NextResponse } from "next/server";
import { getHqUser, hasRole, mintImpersonationToken, impersonationCookie } from "@/lib/hq-auth";
import { getTenantById } from "@/lib/queries/tenants";
import { logHqAction } from "@/lib/hq-audit";

export const dynamic = "force-dynamic";

// Start "view as client". Drops a signed, short-lived, read-only impersonation
// cookie and sends the operator into the client's real /dashboard (or whatever
// onboarding step they're on). Every mutating customer route is guarded by
// assertNotImpersonating(), so this can never change the client's account.
// Requires admin+ : viewing as a client exposes their full PII/dashboard, so it
// sits at the same trust floor as offboard/team-management, not open to every
// 'member' operator.
export async function POST(req: NextRequest, ctx: { params: Promise<{ tenantId: string }> }) {
  const user = await getHqUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!(await hasRole(user, "admin"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { tenantId } = await ctx.params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const token = mintImpersonationToken(tenant.id, user.id);
  await logHqAction(user.id, "impersonate_start", { targetTenantId: tenant.id });

  // The console now lives on admin.superpulse.io but the client app (the real
  // /dashboard we're viewing as) is on www.superpulse.io. Send the operator
  // onto the client host explicitly; the signed cookie is scoped to
  // .superpulse.io (hq-auth.cookieDomain) so it rides across the subdomains.
  const clientOrigin =
    process.env.NODE_ENV === "production" ? "https://www.superpulse.io" : new URL(req.url).origin;
  const res = NextResponse.redirect(new URL("/dashboard", clientOrigin), 303);
  res.cookies.set(impersonationCookie(token));
  return res;
}
