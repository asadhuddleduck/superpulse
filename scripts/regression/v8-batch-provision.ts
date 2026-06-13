/**
 * Pure-function tests for the flag-gated Batch-API ad-set provisioning
 * (src/lib/v8/batch-provision.ts + buildAdSetCreateBody in facebook.ts).
 * No Meta calls, no DB. Run:
 *   node --env-file=.env.local --import tsx scripts/regression/v8-batch-provision.ts
 * Exits non-zero on any failure.
 */

import { buildAdSetCreateBody } from "@/lib/facebook";
import {
  buildAdsetBatchOps,
  reconcileAdsetBatch,
  type AdSetProvisionSpec,
} from "@/lib/v8/batch-provision";
import type { BatchResult } from "@/lib/facebook";

let passed = 0;
const failures: string[] = [];
function assert(cond: boolean, label: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(label);
    console.log(`  ✗ ${label}`);
  }
}

const spec = (over: Partial<AdSetProvisionSpec> = {}): AdSetProvisionSpec => ({
  intentId: 1,
  locationId: 10,
  campaignId: "C1",
  name: "SuperPulse | Soho",
  dailyBudgetPounds: 2,
  radiusMiles: 5,
  lat: 51.5,
  lng: -0.13,
  pageId: "P1",
  ...over,
});

console.log("[regression] v8 batch provisioning (pure)\n");

// --- 1. buildAdSetCreateBody — the shared single-call + batch body ---
const body = buildAdSetCreateBody(spec()) as Record<string, unknown>;
assert(body.daily_budget === 200, "£2/day → daily_budget 200 pence");
assert(body.status === "PAUSED", "ad set created PAUSED");
assert(!("access_token" in body), "shared body excludes access_token (caller adds it)");
assert(body.optimization_goal === "VISIT_INSTAGRAM_PROFILE", "optimization_goal preserved");
assert(body.destination_type === "INSTAGRAM_PROFILE", "destination_type preserved");
assert((body.promoted_object as { page_id: string }).page_id === "P1", "promoted_object.page_id wired");
const tgt = body.targeting as Record<string, unknown>;
assert(JSON.stringify(tgt.instagram_positions) === JSON.stringify(["reels", "story"]), "placements = reels + story only");
assert(JSON.stringify(tgt.device_platforms) === JSON.stringify(["mobile"]), "device = mobile only");
assert((tgt.targeting_automation as { advantage_audience: number }).advantage_audience === 0, "advantage_audience OFF (locality guard)");
const cl = (tgt.geo_locations as { custom_locations: Array<{ radius: number; distance_unit: string }> }).custom_locations[0];
assert(cl.radius === 5 && cl.distance_unit === "mile", "geo radius in miles preserved");
assert(Math.round(2.005 * 100) === (buildAdSetCreateBody(spec({ dailyBudgetPounds: 2.005 })).daily_budget), "budget rounds to nearest pence");

// --- 2. buildAdsetBatchOps — N specs → N ops, act_ prefix stripped, no token ---
const specs = [spec({ intentId: 1, locationId: 10 }), spec({ intentId: 2, locationId: 11, name: "SuperPulse | Bow" })];
const opsA = buildAdsetBatchOps(specs, "act_999");
const opsB = buildAdsetBatchOps(specs, "999");
assert(opsA.length === 2, "2 specs → 2 batch ops");
assert(opsA[0].method === "POST", "op method POST");
assert(opsA[0].relativeUrl === "act_999/adsets", "relativeUrl uses act_<id>/adsets (act_ input)");
assert(opsB[0].relativeUrl === "act_999/adsets", "relativeUrl normalises bare id → act_999/adsets");
assert(!("access_token" in (opsA[0].body as Record<string, unknown>)), "op body carries no access_token");
assert((opsA[1].body as Record<string, unknown>).name === "SuperPulse | Bow", "op body matches its spec");

// --- 3. reconcileAdsetBatch — index mapping + partial failure + edge cases ---
const mkResult = (rows: Array<{ ok: boolean; id?: string; code?: number; error?: string }>): BatchResult => ({
  results: rows.map((r, index) => ({
    index,
    code: r.code ?? (r.ok ? 200 : 400),
    ok: r.ok,
    body: r.id ? { id: r.id } : r.ok ? {} : { error: { message: r.error } },
    error: r.ok ? null : r.error ?? "HTTP 400",
  })),
  okCount: rows.filter((r) => r.ok).length,
  errorCount: rows.filter((r) => !r.ok).length,
});

// all succeed
let out = reconcileAdsetBatch(specs, mkResult([{ ok: true, id: "AS1" }, { ok: true, id: "AS2" }]));
assert(out.length === 2 && out[0].ok && out[0].metaAdsetId === "AS1" && out[1].metaAdsetId === "AS2", "all-ok → ids mapped by index");
assert(out[0].intentId === 1 && out[1].intentId === 2, "outcomes keep their intentId");

// partial failure: op 2 fails → op 1 still ok, op 2 errored (the orphan-safety case)
out = reconcileAdsetBatch(specs, mkResult([{ ok: true, id: "AS1" }, { ok: false, error: "rate limited" }]));
assert(out[0].ok && out[0].metaAdsetId === "AS1", "partial: op 1 stays ok");
assert(!out[1].ok && out[1].metaAdsetId === null && out[1].error === "rate limited", "partial: op 2 errored, no id, reason kept");

// 2xx but no id → treated as failure (don't silently drop)
out = reconcileAdsetBatch([spec()], mkResult([{ ok: true }]));
assert(!out[0].ok && /no ad set id/i.test(out[0].error ?? ""), "2xx-without-id → failure, re-queueable");

// missing result row (short array) → failure, not a crash
out = reconcileAdsetBatch(specs, mkResult([{ ok: true, id: "AS1" }]));
assert(out[1] && !out[1].ok && /missing/i.test(out[1].error ?? ""), "missing batch result → failure");

// empty input → empty output
assert(reconcileAdsetBatch([], mkResult([])).length === 0, "empty specs → empty outcomes");

console.log(`\n[regression] ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.error("FAILURES:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
