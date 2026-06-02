import { NextResponse } from "next/server";
import { getTenantCookie } from "@/lib/auth";
import { getTenantById, setProvisioningStatus } from "@/lib/queries/tenants";
import { getLocationsForTenant } from "@/lib/queries/locations";

// Advances the v8 onboarding from the locations step to the budget step, once
// at least one location exists.
export async function POST() {
  const tenantId = await getTenantCookie();
  if (!tenantId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const tenant = await getTenantById(tenantId);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  if (tenant.provisioningStatus !== "pending_locations") {
    return NextResponse.json({ error: "Not at the locations step" }, { status: 409 });
  }

  const locations = await getLocationsForTenant(tenantId);
  if (locations.length === 0) {
    return NextResponse.json({ error: "Add at least one location first" }, { status: 400 });
  }

  await setProvisioningStatus(tenantId, "pending_budget");
  return NextResponse.json({ ok: true });
}
