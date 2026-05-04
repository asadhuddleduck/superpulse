import type { LocationAdsetRow } from "@/lib/queries/v8";

// 3x spread guardrail + 24h cooldown logic. Pure functions — no DB, no Meta.
//
// applyTilts takes the current adsets + a list of tilt directives and returns
// (a) the budget mutations to write, (b) the directives that were skipped
// with a reason. The 3x spread guardrail clamps the highest budget to no
// more than 3x the lowest. The 24h cooldown blocks back-to-back writes on
// the same adset.

export type Tilt = "up" | "down" | "neutral";

export interface TiltDirective {
  locationId: number;
  tilt: Tilt;
  reason: string;
}

export interface BudgetMutation {
  metaAdsetId: string;
  newDailyBudgetPennies: number;
  reason: string;
}

export const STEP_FRACTION = 0.25; // each up = +25%, each down = -25%
export const FLOOR_PENNIES = 100; // £1/day
export const CEILING_PENNIES = 5000; // £50/day
export const SPREAD_RATIO = 3;
export const COOLDOWN_MS = 24 * 60 * 60 * 1000;

function isCoolingDown(lastGuardrailWriteAt: string | null, now: number): boolean {
  if (!lastGuardrailWriteAt) return false;
  const last = Date.parse(lastGuardrailWriteAt);
  if (Number.isNaN(last)) return false;
  return now - last < COOLDOWN_MS;
}

interface Candidate {
  adset: LocationAdsetRow;
  pennies: number;
  reason: string;
  changed: boolean;
}

export function applyTilts(
  adsets: LocationAdsetRow[],
  tilts: TiltDirective[],
  now: number = Date.now(),
): { mutations: BudgetMutation[]; skipped: Array<{ locationId: number; reason: string }> } {
  // Pass 1 — build candidates map keyed by locationId.
  const candidates = new Map<number, Candidate>();
  for (const adset of adsets) {
    candidates.set(adset.locationId, {
      adset,
      pennies: adset.dailyBudgetPennies ?? FLOOR_PENNIES,
      reason: "unchanged",
      changed: false,
    });
  }

  const skipped: Array<{ locationId: number; reason: string }> = [];

  // Pass 2 — apply each tilt directive in order.
  for (const tilt of tilts) {
    const c = candidates.get(tilt.locationId);
    if (!c) {
      skipped.push({ locationId: tilt.locationId, reason: `no adset for location ${tilt.locationId}` });
      continue;
    }
    if (tilt.tilt === "neutral") continue;
    if (isCoolingDown(c.adset.lastGuardrailWriteAt, now)) {
      skipped.push({ locationId: tilt.locationId, reason: "24h cooldown active" });
      continue;
    }
    const factor = tilt.tilt === "up" ? 1 + STEP_FRACTION : 1 - STEP_FRACTION;
    const stepped = Math.max(FLOOR_PENNIES, Math.min(CEILING_PENNIES, Math.round(c.pennies * factor)));
    if (stepped === c.pennies) {
      skipped.push({ locationId: tilt.locationId, reason: tilt.tilt === "up" ? "up hit ceiling" : "down hit floor" });
      continue;
    }
    c.pennies = stepped;
    c.reason = tilt.reason;
    c.changed = true;
  }

  // Pass 3 — 3x spread clamp. One-shot; clamping only decreases values so
  // the min can't change, so re-iteration is unnecessary.
  const minPennies = Math.min(...Array.from(candidates.values()).map((c) => c.pennies));
  const maxAllowed = minPennies * SPREAD_RATIO;
  for (const c of candidates.values()) {
    if (c.pennies > maxAllowed) {
      c.pennies = maxAllowed;
      c.reason = `${c.reason} (clamped by 3× guardrail)`;
      c.changed = true;
    }
  }

  // Pass 4 — emit mutations only for adsets whose budget actually changed
  // versus their original value. Unchanged adsets produce no mutation.
  const mutations: BudgetMutation[] = [];
  for (const c of candidates.values()) {
    const original = c.adset.dailyBudgetPennies ?? FLOOR_PENNIES;
    if (c.pennies !== original) {
      mutations.push({
        metaAdsetId: c.adset.metaAdsetId,
        newDailyBudgetPennies: c.pennies,
        reason: c.reason,
      });
    }
  }

  return { mutations, skipped };
}
