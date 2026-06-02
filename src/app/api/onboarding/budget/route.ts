import { NextRequest, NextResponse } from "next/server";
import { getTenantCookie } from "@/lib/auth";
import { getTenantById, setTenantBudget } from "@/lib/queries/tenants";
import { getLocationsForTenant } from "@/lib/queries/locations";
import { validateTenantBudget } from "@/lib/v8/budget-plan";
import { writeAuditEvent } from "@/lib/queries/audit-events";

interface BudgetBody {
  monthlyBudgetPennies?: unknown;
}

// Records the client-approved monthly ad budget and flips provisioning_status
// → 'provisioning' (the provision cron then builds campaign + N adsets). Rejects
// budgets that can't fund the per-adset minimum across the tenant's locations.
export async function POST(request: NextRequest) {
  const tenantId = await getTenantCookie();
  if (!tenantId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const tenant = await getTenantById(tenantId);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  if (tenant.provisioningStatus !== "pending_budget") {
    return NextResponse.json({ error: "Not at the budget step" }, { status: 409 });
  }

  const body = (await request.json().catch(() => ({}))) as BudgetBody;
  const monthlyBudgetPennies =
    typeof body.monthlyBudgetPennies === "number" ? Math.round(body.monthlyBudgetPennies) : NaN;
  if (!Number.isFinite(monthlyBudgetPennies) || monthlyBudgetPennies <= 0) {
    return NextResponse.json({ error: "Enter a monthly budget" }, { status: 400 });
  }

  const locations = await getLocationsForTenant(tenantId);
  if (locations.length === 0) {
    return NextResponse.json({ error: "Add at least one location first" }, { status: 400 });
  }

  const check = validateTenantBudget(monthlyBudgetPennies, locations.length);
  if (!check.ok) {
    return NextResponse.json(
      { error: check.message, minMonthlyPennies: check.minMonthlyPennies, minDailyPennies: check.minDailyPennies },
      { status: 400 },
    );
  }

  await setTenantBudget(tenantId, monthlyBudgetPennies);
  await writeAuditEvent(
    tenantId,
    "budget_approved",
    `Budget approved: £${(monthlyBudgetPennies / 100).toFixed(0)}/mo across ${locations.length} locations`,
    { monthlyBudgetPennies, locations: locations.length },
  );

  return NextResponse.json({ ok: true });
}
