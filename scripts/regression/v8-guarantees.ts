/**
 * v8 non-breaking regression net. Run before AND after each phase merge:
 *   node --env-file=.env.local --import tsx scripts/regression/v8-guarantees.ts
 *
 * Asserts the guarantees the rewrite must not violate. Pure-function + gate
 * checks need no DB; the engine-off route checks return before any DB call.
 * Exits non-zero on any failure.
 */

import { execFileSync } from "child_process";

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

async function main() {
  console.log("[regression] v8 non-breaking guarantees\n");

  // --- 1. Budget math (pure) ---
  const { validateTenantBudget, planAdsetBudgets, PER_ADSET_FLOOR } = await import("@/lib/v8/budget-plan");
  const v300 = validateTenantBudget(30000, 62); // £300/mo across 62
  assert(!v300.ok, "£300/mo across 62 locations is rejected");
  assert(v300.minMonthlyPennies >= 180000 && v300.minMonthlyPennies <= 190000, `62-location min ≈ £1,884/mo (got £${(v300.minMonthlyPennies / 100).toFixed(0)})`);
  const plan = planAdsetBudgets(v300.minMonthlyPennies, 62);
  assert(plan.perAdsetDailyPennies === PER_ADSET_FLOOR, "even split floors at £1/day/adset");
  assert(plan.campaignDailyPennies === PER_ADSET_FLOOR * 62, "campaign total = perAdset × N");
  const vOk = validateTenantBudget(200000, 62); // £2000/mo
  assert(vOk.ok, "£2,000/mo across 62 locations is accepted");

  // --- 2. 3× spread guardrail holds at N=62 (pure) ---
  const { applyTilts, SPREAD_RATIO } = await import("@/lib/v8/budget-tilt");
  const adsets = Array.from({ length: 62 }, (_, i) => ({
    id: i + 1,
    tenantCampaignId: 1,
    locationId: i + 1,
    metaAdsetId: `as_${i + 1}`,
    status: "PAUSED",
    dailyBudgetPennies: 100,
    minDailyBudgetPennies: 100,
    maxDailyBudgetPennies: 300,
    currentSpendTodayPennies: 0,
    lastGuardrailWriteAt: null,
    createdAt: new Date().toISOString(),
  }));
  const tilts = adsets.slice(0, 10).map((a) => ({ locationId: a.locationId, tilt: "up" as const, reason: "test" }));
  const { mutations } = applyTilts(adsets, tilts);
  const budgets = adsets.map((a) => {
    const m = mutations.find((x) => x.metaAdsetId === a.metaAdsetId);
    return m ? m.newDailyBudgetPennies : a.dailyBudgetPennies!;
  });
  const max = Math.max(...budgets);
  const min = Math.min(...budgets);
  assert(max <= min * SPREAD_RATIO, `3× spread holds at N=62 (max ${max} ≤ ${SPREAD_RATIO}× min ${min})`);

  // --- 3. Engine off = no-op (route gate returns before any DB call) ---
  delete process.env.V8_ENGINE_ENABLED;
  const routes: Array<[string, string]> = [
    ["scan", "@/app/api/cron/v8/scan/route"],
    ["execute", "@/app/api/cron/v8/execute/route"],
    ["provision", "@/app/api/cron/v8/provision/route"],
  ];
  for (const [name, mod] of routes) {
    const { GET } = (await import(mod)) as { GET: (r: Request) => Promise<Response> };
    const res = await GET(new Request("http://localhost/x"));
    const json = (await res.json()) as { skipped?: boolean };
    assert(json.skipped === true, `v8 ${name} cron skips when V8_ENGINE_ENABLED unset`);
  }

  // --- 4. Intent lanes are separate (steady-state drain excludes creation types) ---
  const { STEADY_STATE_INTENT_TYPES, CREATION_INTENT_TYPES } = await import("@/lib/v8/intents");
  const overlap = STEADY_STATE_INTENT_TYPES.filter((t) => CREATION_INTENT_TYPES.includes(t));
  assert(overlap.length === 0, "steady-state and creation intent lanes don't overlap");

  // --- 5. Protected funnel files untouched vs base branch ---
  const PROTECTED = ["api/waitlist", "api/checkout", "api/webhook/stripe", "lib/email", "api/cron/email-sequence"];
  const base = process.env.BASE_REF ?? "superpulse-waitlist-emails";
  try {
    // execFileSync (no shell) — base is a ref name, not user input, but keep it shell-free.
    const diff = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf-8" })
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const touched = diff.filter((f) => PROTECTED.some((p) => f.includes(p)));
    assert(touched.length === 0, `no protected funnel files touched (${touched.join(", ") || "none"})`);
  } catch (err) {
    assert(false, `git-diff guard ran (${err instanceof Error ? err.message : err})`);
  }

  console.log(`\n[regression] ${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.error("FAILURES:\n" + failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[regression] crashed:", err);
  process.exit(1);
});
