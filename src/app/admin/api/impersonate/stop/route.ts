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

  const res = NextResponse.redirect(new URL(dest, req.url), 303);
  res.cookies.set(clearImpersonationCookie());
  return res;
}

export const GET = handle;
export const POST = handle;
