import type { Tilt, TiltDirective } from "@/lib/v8/budget-tilt";

// Hand-rolled validator for the AI decision output. No zod dependency —
// returns null on first violation rather than throwing or accumulating.
// Per V8-SPEC AI decision layer: invalid output is "dropped silently" and
// the caller logs the raw output to ai_decisions.output_json with valid=0
// for postmortem, plus a v8_decision_invalid audit_event.
//
// The validator accepts any string for tilt.reason / stop.reason (no length
// cap, no enum) — that's deliberate; LLM gets to phrase reasons freely and
// the dashboard can truncate at render time.

export interface AiDecisionOutput {
  budget_tilts: Array<{ location_id: number; tilt: Tilt; reason: string }>;
  stops: Array<{ meta_ad_id: string; reason: string }>;
  narrative: string;
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function validateAiDecisionOutput(raw: unknown): AiDecisionOutput | null {
  if (!isObject(raw)) return null;
  if (!Array.isArray(raw.budget_tilts)) return null;
  if (!Array.isArray(raw.stops)) return null;
  if (typeof raw.narrative !== "string") return null;

  const tilts: AiDecisionOutput["budget_tilts"] = [];
  for (const t of raw.budget_tilts) {
    if (!isObject(t)) return null;
    if (typeof t.location_id !== "number" || !Number.isFinite(t.location_id)) return null;
    if (t.tilt !== "up" && t.tilt !== "down" && t.tilt !== "neutral") return null;
    if (typeof t.reason !== "string") return null;
    tilts.push({ location_id: t.location_id, tilt: t.tilt as Tilt, reason: t.reason });
  }

  const stops: AiDecisionOutput["stops"] = [];
  for (const s of raw.stops) {
    if (!isObject(s)) return null;
    if (typeof s.meta_ad_id !== "string" || !s.meta_ad_id) return null;
    if (typeof s.reason !== "string") return null;
    stops.push({ meta_ad_id: s.meta_ad_id, reason: s.reason });
  }

  return { budget_tilts: tilts, stops, narrative: raw.narrative };
}

// Adapter for budget-tilt.applyTilts — takes the validated output and
// returns the directives shape applyTilts expects.
export function toTiltDirectives(out: AiDecisionOutput): TiltDirective[] {
  return out.budget_tilts.map((t) => ({
    locationId: t.location_id,
    tilt: t.tilt,
    reason: t.reason,
  }));
}
