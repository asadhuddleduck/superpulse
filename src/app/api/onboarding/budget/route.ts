import { NextRequest, NextResponse } from "next/server";
import { getTenantCookie } from "@/lib/auth";
import { impersonationGuard } from "@/lib/hq-auth";
import { getTenantById, setTenantBudget } from "@/lib/queries/tenants";
import { getLocationsForTenant } from "@/lib/queries/locations";
import { validateTenantBudget, monthlyFromPerLocationDaily, PER_ADSET_FLOOR } from "@/lib/v8/budget-plan";
import { writeAuditEvent } from "@/lib/queries/audit-events";

interface BudgetBody {
  // The client inputs a small per-location, per-day figure (e.g. £2). We derive
  // and store the monthly total so the engine contract is unchanged.
  perLocationDailyPennies?: unknown;
}

export async function POST(request: NextRequest) {
  const ro = await impersonationGuard();
  if (ro) return ro;
  const tenantId = await getTenantCookie();
  if (!tenantId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const tenant = await getTenantById(tenantId);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  if (tenant.provisioningStatus !== "pending_budget") {
    return NextResponse.json({ error: "Not at the budget step" }, { status: 409 });
  }

  const body = (await request.json().catch(() => ({}))) as BudgetBody;
  const perLocationDailyPennies =
    typeof body.perLocationDailyPennies === "number" ? Math.round(body.perLocationDailyPennies) : NaN;
  if (!Number.isFinite(perLocationDailyPennies) || perLocationDailyPennies <= 0) {
    return NextResponse.json({ error: "Enter a daily budget per location" }, { status: 400 });
  }
  if (perLocationDailyPennies < PER_ADSET_FLOOR) {
    return NextResponse.json(
      {
        error: `Meta needs at least £${(PER_ADSET_FLOOR / 100).toFixed(0)}/day per location to deliver.`,
        minPerLocationDailyPennies: PER_ADSET_FLOOR,
      },
      { status: 400 },
    );
  }

  const locations = await getLocationsForTenant(tenantId);
  if (locations.length === 0) {
    return NextResponse.json({ error: "Add at least one location first" }, { status: 400 });
  }

  const monthlyBudgetPennies = monthlyFromPerLocationDaily(perLocationDailyPennies, locations.length);
  // Belt-and-braces: the stored monthly must still clear the per-adset floor.
  const check = validateTenantBudget(monthlyBudgetPennies, locations.length);
  if (!check.ok) {
    return NextResponse.json({ error: check.message }, { status: 400 });
  }

  await setTenantBudget(tenantId, monthlyBudgetPennies);
  await writeAuditEvent(
    tenantId,
    "budget_approved",
    `Budget approved: £${(perLocationDailyPennies / 100).toFixed(2)}/day per location × ${locations.length} = £${(monthlyBudgetPennies / 100).toFixed(0)}/mo`,
    { perLocationDailyPennies, monthlyBudgetPennies, locations: locations.length },
  );

  return NextResponse.json({ ok: true });
}
