// Codified stop rules per V8-SPEC.md §22. Pure functions — no DB, no Meta.
//
// Order of checks in evaluateAd: low_ctr -> cpv_ceiling -> zero_visits ->
// max_age. First hit wins. So a £6-spent-zero-visits ad that's also 65 days
// old returns "zero_visits", not "max_age". max_age is the catch-all last-stop.

export type StopReason = "low_ctr" | "cpv_ceiling" | "zero_visits" | "max_age";

export interface AdPerformance {
  impressions: number;
  clicks: number;
  spendPennies: number;
  profileVisits: number;
}

export const CTR_WARMUP_IMPRESSIONS = 1000;
export const CTR_FLOOR = 0.005;
export const CPV_WARMUP_PENNIES = 200; // £2
export const CPV_CEILING_PENNIES = 25;
export const ZERO_VISIT_SPEND_PENNIES = 500; // £5
export const MAX_AGE_DAYS = 60;

export function evaluateAd(perf: AdPerformance, adAgeDays: number): StopReason | null {
  // 1. CTR floor (only after enough impressions to be statistically meaningful).
  if (perf.impressions >= CTR_WARMUP_IMPRESSIONS) {
    const ctr = perf.impressions === 0 ? 0 : perf.clicks / perf.impressions;
    if (ctr < CTR_FLOOR) return "low_ctr";
  }

  // 2. Cost-per-profile-visit ceiling (only after warmup spend).
  if (perf.spendPennies >= CPV_WARMUP_PENNIES && perf.profileVisits > 0) {
    const cpv = perf.spendPennies / perf.profileVisits;
    if (cpv > CPV_CEILING_PENNIES) return "cpv_ceiling";
  }

  // 3. Zero profile visits despite £5 spent.
  if (perf.spendPennies >= ZERO_VISIT_SPEND_PENNIES && perf.profileVisits === 0) {
    return "zero_visits";
  }

  // 4. Max age — catch-all for stale ads that never tripped any threshold.
  if (adAgeDays > MAX_AGE_DAYS) return "max_age";

  return null;
}
