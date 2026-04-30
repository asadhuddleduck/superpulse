import { NextRequest, NextResponse } from "next/server";
import { setTenantCookie } from "@/lib/auth";

/**
 * Dev-only helper: set the tenant cookie to a given id without going through
 * Facebook OAuth. Used for local QA against legacy tenants.
 *
 * Hard-disabled in production via NODE_ENV check.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 404 });
  }

  const tenantId = request.nextUrl.searchParams.get("tenant_id");
  if (!tenantId) {
    return NextResponse.json({ error: "tenant_id required" }, { status: 400 });
  }

  await setTenantCookie(tenantId);
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
