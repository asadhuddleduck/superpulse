/**
 * v8 62-location soak harness. Drives the NEW engine path (provision → execute),
 * not the old direct-create soak. Two phases:
 *
 *   SEED (always): seed N synthetic UK locations for the soak tenant, set a
 *   viable monthly budget (N × £1/day), and flip provisioning_status →
 *   'provisioning' so the provision cron will pick it up.
 *
 *   DRIVE (--drive): locally loop the provision + execute cron handlers until
 *   the build is done — creates 1 campaign + N adsets + (N × reels) ads on
 *   act_1059094086326037, ALL PAUSED (£0 spend). Activation is NOT driven here
 *   (that needs Meta review via the monitor cron). Tear down with
 *   scripts/teardown-probe-campaigns.mjs (deletes only £0-spend campaigns).
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/v8-soak-62.ts            # seed only, 62 locations
 *   node --env-file=.env.local --import tsx scripts/v8-soak-62.ts --locations=10
 *   node --env-file=.env.local --import tsx scripts/v8-soak-62.ts --drive    # seed + build (real Meta writes, PAUSED)
 *
 * Tenant defaults to t_fb_3426122537565919 (Asad's IG on act_1059094086326037).
 * Override via TENANT_ID env var.
 */

import { runSchema, db } from "@/lib/db";
import { getTenantById, setTenantBudget, updateTenantStatus } from "@/lib/queries/tenants";
import { replaceLocationsForTenant, type LocationInput } from "@/lib/queries/locations";
import { validateTenantBudget } from "@/lib/v8/budget-plan";

const TENANT_ID = process.env.TENANT_ID ?? "t_fb_3426122537565919";

function arg(name: string): string | null {
  for (const a of process.argv.slice(2)) {
    const m = a.match(new RegExp(`^--${name}=(.+)$`));
    if (m) return m[1];
  }
  return null;
}
function flag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}

// Deterministic jittered coords around Birmingham (~±0.08° ≈ 9km) — distinct
// enough that each adset has its own geo target.
function synthLocations(n: number): LocationInput[] {
  const baseLat = 52.4862;
  const baseLng = -1.8904;
  const out: LocationInput[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      name: `Soak Loc ${i + 1}`,
      address: `Soak Loc ${i + 1}, Birmingham`,
      latitude: baseLat + ((i % 8) * 0.02 - 0.08),
      longitude: baseLng + (Math.floor(i / 8) * 0.02 - 0.08),
      radiusMiles: 5,
    });
  }
  return out;
}

async function count(sql: string): Promise<number> {
  const r = await db.execute(sql);
  return Number((r.rows[0] as Record<string, unknown> | undefined)?.c ?? 0);
}

async function pendingCreationIntents(tenantId: string): Promise<number> {
  const r = await db.execute({
    sql: `SELECT COUNT(*) c FROM v8_intents WHERE tenant_id=? AND status='pending' AND intent_type IN ('PROVISION_ADSET','CREATE_AD','ACTIVATE_AD')`,
    args: [tenantId],
  });
  return Number((r.rows[0] as Record<string, unknown>).c ?? 0);
}

async function main() {
  const nLocations = Number(arg("locations") ?? "62");
  const drive = flag("drive");
  console.log(`[soak-62] tenant=${TENANT_ID} locations=${nLocations} drive=${drive}`);

  await runSchema();
  console.log("[soak-62] schema migrated");

  const tenant = await getTenantById(TENANT_ID);
  if (!tenant) throw new Error(`tenant ${TENANT_ID} not found`);
  if (drive) {
    if (!tenant.metaAccessToken) throw new Error("tenant missing meta_access_token (needed for --drive)");
    if (!tenant.adAccountId || !tenant.pageId || !tenant.igUserId || !tenant.igUsername) {
      throw new Error("tenant missing adAccount/page/ig fields (needed for --drive)");
    }
  }

  // SEED ----------------------------------------------------------------
  await replaceLocationsForTenant(TENANT_ID, synthLocations(nLocations));
  console.log(`[soak-62] seeded ${nLocations} locations`);

  const budget = validateTenantBudget(0, nLocations); // minMonthly for N locations
  await updateTenantStatus(TENANT_ID, "active");
  await setTenantBudget(TENANT_ID, budget.minMonthlyPennies); // → provisioning_status='provisioning'
  console.log(
    `[soak-62] budget set £${(budget.minMonthlyPennies / 100).toFixed(0)}/mo (£${(budget.minDailyPennies / 100).toFixed(0)}/day across ${nLocations}), provisioning_status='provisioning'`,
  );

  if (!drive) {
    console.log("\n[soak-62] SEED done. Re-run with --drive to build, or let the crons run.");
    return;
  }

  // DRIVE ---------------------------------------------------------------
  process.env.V8_ENGINE_ENABLED = "on";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) throw new Error("CRON_SECRET not set — needed to authorize the cron handlers");
  const authHeaders = { authorization: `Bearer ${cronSecret}` };
  const provisionReq = () => new Request("http://localhost/api/cron/v8/provision", { headers: authHeaders });
  const executeReq = () => new Request("http://localhost/api/cron/v8/execute", { headers: authHeaders });

  const { GET: provisionGET } = await import("@/app/api/cron/v8/provision/route");
  const { GET: executeGET } = await import("@/app/api/cron/v8/execute/route");

  const MAX_ITERS = 400;
  for (let i = 0; i < MAX_ITERS; i++) {
    const pRes = await provisionGET(provisionReq());
    const p = (await pRes.json()) as { adsetIntentsEnqueued?: number; adIntentsEnqueued?: number };
    const eRes = await executeGET(executeReq());
    const e = (await eRes.json()) as { creationsDone?: number; intentsErrored?: number };
    const pending = await pendingCreationIntents(TENANT_ID);
    const enq = (p.adsetIntentsEnqueued ?? 0) + (p.adIntentsEnqueued ?? 0);
    console.log(
      `[soak-62] iter ${i + 1}: enqueued=${enq} created=${e.creationsDone ?? 0} errored=${e.intentsErrored ?? 0} pending=${pending}`,
    );
    if (enq === 0 && (e.creationsDone ?? 0) === 0 && pending === 0) break;
  }

  const adsets = await count(
    `SELECT COUNT(*) c FROM location_adsets la JOIN tenant_campaigns tc ON tc.id=la.tenant_campaign_id WHERE tc.tenant_id='${TENANT_ID}'`,
  );
  const ads = await count(
    `SELECT COUNT(*) c FROM reel_ads ra JOIN location_adsets la ON la.id=ra.location_adset_id JOIN tenant_campaigns tc ON tc.id=la.tenant_campaign_id WHERE tc.tenant_id='${TENANT_ID}'`,
  );
  console.log(`\n[soak-62] DONE — ${adsets} adsets, ${ads} ads (all PAUSED).`);
  console.log("Verify on Meta + Turso, then tear down £0 campaigns:");
  console.log("  node --env-file=.env.local --import tsx scripts/teardown-probe-campaigns.mjs   # dry-run first");
}

main().catch((err) => {
  console.error("[soak-62] failed:", err);
  process.exit(1);
});
