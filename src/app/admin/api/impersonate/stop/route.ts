import { NextRequest, NextResponse } from "next/server";
import { getImpersonation, clearImpersonationCookie } from "@/lib/hq-auth";
import { logHqAction } from "@/lib/hq-audit";

export const dynamic = "force-dynamic";

// End "view as client" — clear the impersonation cookie and return to the
// client's detail page (so the operator lands back where they came from).
async function handle(req: NextRequest) {
  const imp = await getImpersonation();
  const dest = imp ? `/admin/clients/${encodeURIComponent(imp.tenantId)}` : "/admin";
  if (imp) await logHqAction(imp.hqUser.id, "impersonate_stop", { targetTenantId: imp.tenantId });

  // The "Exit" banner lives on the client app (www.superpulse.io/dashboard);
  // send the operator back to the console on admin.superpulse.io. The cleared
  // cookie is .superpulse.io-scoped so it drops across both subdomains.
  const adminOrigin =
    process.env.NODE_ENV === "production" ? "https://admin.superpulse.io" : new URL(req.url).origin;
  const res = NextResponse.redirect(new URL(dest, adminOrigin), 303);
  res.cookies.set(clearImpersonationCookie());
  return res;
}

export const GET = handle;
export const POST = handle;
