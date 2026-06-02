import { FLOOR_PENNIES, CEILING_PENNIES, SPREAD_RATIO } from "@/lib/v8/budget-tilt";

// Budget intake + per-adset distribution math for multi-location tenants.
// Pure functions — no DB, no Meta — mirroring the discipline of budget-tilt.ts.
//
// The engine is ABO (per-adset daily budgets; createCampaign sets no campaign
// budget, createAdSet sets daily_budget per adset at IMPRESSIONS billing). So a
// tenant's monthly budget is split EVENLY across its N location adsets, floored
// at the per-adset minimum. The single source of truth used by BOTH the
// onboarding validator (src/app/api/onboarding/budget) AND the provisioning
// lane's pre-flight guard (src/lib/v8/provision).

// Meta's documented minimum daily budget per ad set for IMPRESSIONS billing is
// ~£1/day. The engine's own floor (FLOOR_PENNIES) is also £1/day. Take the max
// so neither constraint is violated.
export const META_MIN_ADSET_PENNIES = 100; // £1.00/day
export const PER_ADSET_FLOOR = Math.max(FLOOR_PENNIES, META_MIN_ADSET_PENNIES);
export const DAYS_PER_MONTH = 30.4;

export interface AdsetBudgetPlan {
  /** Even split, floored at PER_ADSET_FLOOR. Written to each location_adsets row. */
  perAdsetDailyPennies: number;
  /** perAdset × N — the true Meta-visible daily total (recorded on tenant_campaigns). */
  campaignDailyPennies: number;
  /** 3× spread guardrail floor stamped on each adset. */
  minDailyBudgetPennies: number;
  /** 3× spread guardrail ceiling, capped at CEILING_PENNIES. */
  maxDailyBudgetPennies: number;
}

/**
 * Split a tenant's approved monthly budget across N location adsets. Even split
 * at launch so the 3× spread guardrail starts from a clean equal baseline.
 * Callers MUST have validated with validateTenantBudget first — this floors at
 * PER_ADSET_FLOOR but does not reject under-budget inputs.
 */
export function planAdsetBudgets(monthlyBudgetPennies: number, locationCount: number): AdsetBudgetPlan {
  const n = Math.max(1, locationCount);
  const dailyTotal = Math.round(monthlyBudgetPennies / DAYS_PER_MONTH);
  const perAdset = Math.max(PER_ADSET_FLOOR, Math.floor(dailyTotal / n));
  return {
    perAdsetDailyPennies: perAdset,
    campaignDailyPennies: perAdset * n,
    minDailyBudgetPennies: PER_ADSET_FLOOR,
    maxDailyBudgetPennies: Math.min(CEILING_PENNIES, PER_ADSET_FLOOR * SPREAD_RATIO),
  };
}

export interface BudgetValidation {
  ok: boolean;
  /** Smallest legal monthly budget for this location count. */
  minMonthlyPennies: number;
  /** Smallest legal daily budget = locationCount × PER_ADSET_FLOOR. */
  minDailyPennies: number;
  /** User-facing copy when !ok. */
  message?: string;
}

/**
 * Reject budgets where the even per-adset split would fall below Meta's (and
 * the engine's) per-adset minimum. This is the hard answer to "a 62-location
 * tenant must commit ≥ £62/day (~£1,884/mo)". Enforced at onboarding AND again
 * as a pre-flight guard before any Meta budget write in provisioning.
 */
export function validateTenantBudget(monthlyBudgetPennies: number, locationCount: number): BudgetValidation {
  const n = Math.max(1, locationCount);
  const minDaily = n * PER_ADSET_FLOOR;
  const minMonthly = Math.ceil(minDaily * DAYS_PER_MONTH);
  const dailyTotal = Math.round(monthlyBudgetPennies / DAYS_PER_MONTH);
  if (dailyTotal < minDaily) {
    const minDailyGBP = (minDaily / 100).toFixed(0);
    const minMonthlyGBP = (minMonthly / 100).toFixed(0);
    return {
      ok: false,
      minMonthlyPennies: minMonthly,
      minDailyPennies: minDaily,
      message: `${n} location${n === 1 ? "" : "s"} needs at least £${minDailyGBP}/day (about £${minMonthlyGBP}/month) to deliver in every one. Increase your budget or remove some locations.`,
    };
  }
  return { ok: true, minMonthlyPennies: minMonthly, minDailyPennies: minDaily };
}
