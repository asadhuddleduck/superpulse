import { NextRequest, NextResponse } from "next/server";
import { getHqUser, mintImpersonationToken, impersonationCookie } from "@/lib/hq-auth";
import { getTenantById } from "@/lib/queries/tenants";
import { logHqAction } from "@/lib/hq-audit";

export const dynamic = "force-dynamic";

// Start "view as client". Drops a signed, short-lived, read-only impersonation
// cookie and sends the operator into the client's real /dashboard (or whatever
// onboarding step they're on). Every mutating customer route is guarded by
// assertNotImpersonating(), so this can never change the client's account.
export async function POST(req: NextRequest, ctx: { params: Promise<{ tenantId: string }> }) {
  const user = await getHqUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { tenantId } = await ctx.params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const token = mintImpersonationToken(tenant.id, user.id);
  await logHqAction(user.id, "impersonate_start", { targetTenantId: tenant.id });

  const res = NextResponse.redirect(new URL("/dashboard", req.url), 303);
  res.cookies.set(impersonationCookie(token));
  return res;
}
