import { NextResponse } from "next/server";
import {
  updateAdSetDailyBudget,
  updateNodeStatus,
  createAdSet,
  createAdCreative,
  createAd,
} from "@/lib/facebook";
import { checkCronAuth } from "@/lib/cron-auth";
import { getActiveTenants, type Tenant } from "@/lib/queries/tenants";
import {
  getTenantCampaign,
  getLocationAdsets,
  recordAdsetBudgetWrite,
  recordReelAdRetirement,
  upsertLocationAdset,
  upsertReelAd,
  recordAdsetGuardrails,
  reelAdExists,
  setReelAdStatus,
  setLocationAdsetStatus,
  setTenantCampaignStatus,
  type LocationAdsetRow,
  type TenantCampaignRow,
} from "@/lib/queries/v8";
import {
  drainPendingIntents,
  drainPendingCreationIntents,
  markIntentDone,
  markIntentSkipped,
  markIntentErrored,
  enqueueIntent,
  type IntentRow,
  type BudgetTiltPayload,
  type StopAdPayload,
  type ProvisionAdsetPayload,
  type CreateAdPayload,
  type ActivateAdPayload,
} from "@/lib/v8/intents";
import { applyTilts, type TiltDirective } from "@/lib/v8/budget-tilt";
import { planAdsetBudgets } from "@/lib/v8/budget-plan";
import {
  checkAppBreaker,
  CIRCUIT_BREAKER_THRESHOLD,
  CREATION_BREAKER_THRESHOLD,
} from "@/lib/v8/circuit-breaker";
import { getLocationsForTenant, type Location } from "@/lib/queries/locations";
import { classifyMetaError } from "@/lib/meta-errors";
import { markPostIneligible } from "@/lib/queries/posts";
import { logApiCall } from "@/lib/queries/api-calls";
import { writeAuditEvent } from "@/lib/queries/audit-events";

// v8 execute cron — 30-min cadence. The SINGLE Meta-mutation consumer. Two
// independent drain lanes per tenant:
//   - STEADY-STATE: up to 3 BUDGET_TILT/STOP_AD intents. Re-validates tilts vs
//     fresh adset state via applyTilts (3× spread + 24h cooldown), applies
//     STOP_AD via updateNodeStatus + recordReelAdRetirement.
//   - CREATION: up to 8 PROVISION_ADSET/CREATE_AD/ACTIVATE_AD intents — creates
//     adsets/ads PAUSED, activates after review (child→parent cascade).
// Shared per-app circuit breaker gates both. Everything is created PAUSED;
// activation is a separate ACTIVATE_AD step enqueued by the monitor review poll.

export const maxDuration = 60;

const MAX_INTENTS_PER_TICK = 3;
const MAX_CREATION_PER_TICK = 8;

interface TenantExecuteResult {
  tenantId: string;
  drained: number;
  done: number;
  skipped: number;
  errored: number;
  created: number;
  error?: string;
}

function isBudgetTiltPayload(intent: IntentRow): intent is IntentRow & { payload: BudgetTiltPayload } {
  return intent.intentType === "BUDGET_TILT";
}
function isStopAdPayload(intent: IntentRow): intent is IntentRow & { payload: StopAdPayload } {
  return intent.intentType === "STOP_AD";
}

async function executeOneTenant(tenant: Tenant): Promise<TenantExecuteResult> {
  const result: TenantExecuteResult = {
    tenantId: tenant.id,
    drained: 0,
    done: 0,
    skipped: 0,
    errored: 0,
    created: 0,
  };

  const token = tenant.metaAccessToken;
  if (!token) {
    result.error = "missing meta credentials";
    return result;
  }

  // Shared per-app breaker (read once): peak >50% halts BOTH lanes; >35% halts
  // only the creation burst lane so steady-state budget/stop keeps the headroom.
  const breaker = await checkAppBreaker(CREATION_BREAKER_THRESHOLD);
  const haltSteady = breaker.peak > CIRCUIT_BREAKER_THRESHOLD;
  const haltCreation = breaker.peak > CREATION_BREAKER_THRESHOLD;
  if (haltSteady) {
    await writeAuditEvent(tenant.id, "v8_circuit_breaker_tripped", `v8 execute: halted (X-App-Usage ${breaker.peak}%)`, { peak: breaker.peak });
  } else if (haltCreation) {
    await writeAuditEvent(tenant.id, "v8_circuit_breaker_tripped", `v8 execute: creation lane halted (X-App-Usage ${breaker.peak}%)`, { peak: breaker.peak });
  }

  // Snapshot campaign + adsets once; both lanes + the local cache below use them.
  const tenantCampaign = await getTenantCampaign(tenant.id);
  const adsets: LocationAdsetRow[] = tenantCampaign ? await getLocationAdsets(tenantCampaign.id) : [];
  const adsetsByMetaId = new Map<string, LocationAdsetRow>(adsets.map((a) => [a.metaAdsetId, a]));

  // ---------- Steady-state lane: BUDGET_TILT + STOP_AD ----------
  const intents = haltSteady ? [] : await drainPendingIntents(tenant.id, MAX_INTENTS_PER_TICK);
  result.drained += intents.length;

  for (const intent of intents) {
    try {
      if (isBudgetTiltPayload(intent)) {
        const payload = intent.payload;
        const adset = adsetsByMetaId.get(payload.metaAdsetId);
        if (!adset) {
          await markIntentSkipped(intent.id, `adset gone for ${payload.metaAdsetId}`);
          result.skipped++;
          await writeAuditEvent(tenant.id, "v8_intent_skipped", "BUDGET_TILT skipped", {
            intentId: intent.id,
            payload,
            reason: "adset gone",
          });
          continue;
        }
        const current = adset.dailyBudgetPennies ?? 100;
        if (payload.newDailyBudgetPennies === current) {
          await markIntentSkipped(intent.id, "no-op vs current budget");
          result.skipped++;
          await writeAuditEvent(tenant.id, "v8_intent_skipped", "BUDGET_TILT no-op", {
            intentId: intent.id,
            payload,
            reason: "no-op vs current",
          });
          continue;
        }
        // Re-validate via applyTilts with a single directive against fresh state.
        const directive: TiltDirective = {
          locationId: adset.locationId,
          tilt: payload.newDailyBudgetPennies > current ? "up" : "down",
          reason: payload.reason,
        };
        const { mutations, skipped } = applyTilts(Array.from(adsetsByMetaId.values()), [directive]);
        const mutation = mutations.find((m) => m.metaAdsetId === payload.metaAdsetId);
        if (!mutation) {
          const reason = skipped[0]?.reason ?? "guardrail re-validation produced no mutation";
          await markIntentSkipped(intent.id, reason);
          result.skipped++;
          await writeAuditEvent(tenant.id, "v8_intent_skipped", "BUDGET_TILT guardrail-blocked", {
            intentId: intent.id,
            payload,
            reason,
          });
          continue;
        }

        // Apply Meta mutation.
        const callStart = Date.now();
        try {
          await updateAdSetDailyBudget(payload.metaAdsetId, mutation.newDailyBudgetPennies, token);
          await logApiCall({
            tenantId: tenant.id,
            endpoint: `/${payload.metaAdsetId}`,
            method: "POST",
            statusCode: 200,
            durationMs: Date.now() - callStart,
          });
        } catch (err) {
          await logApiCall({
            tenantId: tenant.id,
            endpoint: `/${payload.metaAdsetId}`,
            method: "POST",
            statusCode: 500,
            durationMs: Date.now() - callStart,
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }

        // Persist + update local cache so subsequent intents see new budget.
        await recordAdsetBudgetWrite(payload.metaAdsetId, mutation.newDailyBudgetPennies);
        adsetsByMetaId.set(payload.metaAdsetId, {
          ...adset,
          dailyBudgetPennies: mutation.newDailyBudgetPennies,
          lastGuardrailWriteAt: new Date().toISOString(),
        });
        await markIntentDone(intent.id);
        result.done++;
        await writeAuditEvent(tenant.id, "v8_intent_executed", "BUDGET_TILT applied", {
          intentId: intent.id,
          metaAdsetId: payload.metaAdsetId,
          oldPennies: current,
          newPennies: mutation.newDailyBudgetPennies,
          reason: mutation.reason,
        });
      } else if (isStopAdPayload(intent)) {
        const payload = intent.payload;
        const callStart = Date.now();
        try {
          await updateNodeStatus(payload.metaAdId, "PAUSED", token);
          await logApiCall({
            tenantId: tenant.id,
            endpoint: `/${payload.metaAdId}`,
            method: "POST",
            statusCode: 200,
            durationMs: Date.now() - callStart,
          });
        } catch (err) {
          await logApiCall({
            tenantId: tenant.id,
            endpoint: `/${payload.metaAdId}`,
            method: "POST",
            statusCode: 500,
            durationMs: Date.now() - callStart,
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
        await recordReelAdRetirement(payload.metaAdId, payload.reason);
        await markIntentDone(intent.id);
        result.done++;
        await writeAuditEvent(tenant.id, "v8_ad_retired", `Ad retired: ${payload.reason}`, {
          intentId: intent.id,
          payload,
        });
      } else {
        await markIntentSkipped(intent.id, `unknown intent_type ${intent.intentType}`);
        result.skipped++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await markIntentErrored(intent.id, msg);
      result.errored++;
      await writeAuditEvent(tenant.id, "v8_intent_skipped", "intent errored", {
        intentId: intent.id,
        error: msg.slice(0, 200),
      });
    }
  }

  // ---------- Creation lane: PROVISION_ADSET / CREATE_AD / ACTIVATE_AD ----------
  if (!haltCreation && tenantCampaign) {
    await processCreationIntents(tenant, token, tenantCampaign, adsets, adsetsByMetaId, result);
  }

  return result;
}

// Creation lane — drains up to MAX_CREATION_PER_TICK creation intents and does
// the Meta writes. Everything is created PAUSED; ACTIVATE_AD (enqueued by the
// monitor review poll once Meta clears the ad) flips PAUSED→ACTIVE with a
// child→parent cascade. NEVER calls deleteCampaign — the v8 campaign is shared.
async function processCreationIntents(
  tenant: Tenant,
  token: string,
  campaign: TenantCampaignRow,
  adsets: LocationAdsetRow[],
  adsetsByMetaId: Map<string, LocationAdsetRow>,
  result: TenantExecuteResult,
): Promise<void> {
  const adAccountId = tenant.adAccountId;
  if (!adAccountId || !tenant.pageId || !tenant.igUserId || !tenant.igUsername) return;
  const cleanAdAccountId = adAccountId.startsWith("act_") ? adAccountId.slice(4) : adAccountId;

  const intents = await drainPendingCreationIntents(tenant.id, MAX_CREATION_PER_TICK);
  if (intents.length === 0) return;
  result.drained += intents.length;

  const locations = await getLocationsForTenant(tenant.id);
  const locationsById = new Map<number, Location>(locations.map((l) => [l.id, l]));
  const adsetsById = new Map<number, LocationAdsetRow>(adsets.map((a) => [a.id, a]));
  const plan = planAdsetBudgets(tenant.monthlyAdBudgetPennies ?? 0, Math.max(1, locations.length));
  let campaignStatus = campaign.status;

  for (const intent of intents) {
    try {
      if (intent.intentType === "PROVISION_ADSET") {
        const payload = intent.payload as ProvisionAdsetPayload;
        const loc = locationsById.get(payload.locationId);
        if (!loc) {
          await markIntentSkipped(intent.id, `location ${payload.locationId} gone`);
          result.skipped++;
          continue;
        }
        const callStart = Date.now();
        let metaAdsetId: string;
        try {
          const adset = await createAdSet(
            campaign.metaCampaignId,
            cleanAdAccountId,
            `SuperPulse | ${loc.name}`,
            plan.perAdsetDailyPennies / 100,
            loc.radiusMiles,
            loc.latitude,
            loc.longitude,
            tenant.pageId,
            token,
          );
          metaAdsetId = adset.id;
          await logApiCall({ tenantId: tenant.id, endpoint: `/act_${cleanAdAccountId}/adsets`, method: "POST", statusCode: 200, durationMs: Date.now() - callStart });
        } catch (err) {
          await logApiCall({ tenantId: tenant.id, endpoint: `/act_${cleanAdAccountId}/adsets`, method: "POST", statusCode: 500, durationMs: Date.now() - callStart, error: err instanceof Error ? err.message : String(err) });
          throw err;
        }
        await upsertLocationAdset({ tenantCampaignId: campaign.id, locationId: loc.id, metaAdsetId, status: "PAUSED", dailyBudgetPennies: plan.perAdsetDailyPennies });
        await recordAdsetGuardrails(metaAdsetId, plan.minDailyBudgetPennies, plan.maxDailyBudgetPennies);
        adsetsByMetaId.set(metaAdsetId, {
          id: 0,
          tenantCampaignId: campaign.id,
          locationId: loc.id,
          metaAdsetId,
          status: "PAUSED",
          dailyBudgetPennies: plan.perAdsetDailyPennies,
          minDailyBudgetPennies: plan.minDailyBudgetPennies,
          maxDailyBudgetPennies: plan.maxDailyBudgetPennies,
          currentSpendTodayPennies: 0,
          lastGuardrailWriteAt: null,
          createdAt: new Date().toISOString(),
        });
        await markIntentDone(intent.id);
        result.done++;
        result.created++;
        await writeAuditEvent(tenant.id, "v8_provision_adset_created", `Ad set created for ${loc.name}`, { metaAdsetId, locationId: loc.id });
      } else if (intent.intentType === "CREATE_AD") {
        const payload = intent.payload as CreateAdPayload;
        // Idempotency: a prior tick may have created the row before crashing.
        if (await reelAdExists(payload.locationAdsetId, payload.postId)) {
          await markIntentDone(intent.id);
          result.done++;
          continue;
        }
        const callStart = Date.now();
        try {
          const creative = await createAdCreative(cleanAdAccountId, `SuperPulse | ${payload.postId}`, payload.postId, tenant.igUserId, tenant.igUsername, tenant.pageId, token);
          const ad = await createAd(payload.metaAdsetId, cleanAdAccountId, `SuperPulse | ${payload.postId} · ad`, creative.id, token);
          await logApiCall({ tenantId: tenant.id, endpoint: `/act_${cleanAdAccountId}/ads`, method: "POST", statusCode: 200, durationMs: Date.now() - callStart });
          await upsertReelAd({ locationAdsetId: payload.locationAdsetId, postId: payload.postId, metaAdId: ad.id, metaCreativeId: creative.id, status: "PAUSED" });
          await markIntentDone(intent.id);
          result.done++;
          result.created++;
          await writeAuditEvent(tenant.id, "v8_provision_ad_created", `Ad created for post ${payload.postId}`, { metaAdId: ad.id, metaAdsetId: payload.metaAdsetId, postId: payload.postId });
        } catch (err) {
          await logApiCall({ tenantId: tenant.id, endpoint: `/act_${cleanAdAccountId}/ads`, method: "POST", statusCode: 500, durationMs: Date.now() - callStart, error: err instanceof Error ? err.message : String(err) });
          const rejection = classifyMetaError(err);
          if (rejection?.permanent) {
            // Permanent (e.g. copyright music): flip the post ineligible so every
            // sibling adset stops trying it, and skip (no requeue). NOT deleteCampaign.
            await markPostIneligible(payload.postId, rejection.reason);
            await markIntentSkipped(intent.id, rejection.reason);
            result.skipped++;
            await writeAuditEvent(tenant.id, "review_failed", `Post ${payload.postId} permanently ineligible: ${rejection.reason}`, { postId: payload.postId, reason: rejection.reason });
          } else {
            throw err; // transient → outer catch marks errored; provision re-enqueues next tick
          }
        }
      } else if (intent.intentType === "ACTIVATE_AD") {
        const payload = intent.payload as ActivateAdPayload;
        const callStart = Date.now();
        try {
          await updateNodeStatus(payload.metaAdId, "ACTIVE", token);
          await logApiCall({ tenantId: tenant.id, endpoint: `/${payload.metaAdId}`, method: "POST", statusCode: 200, durationMs: Date.now() - callStart });
        } catch (err) {
          await logApiCall({ tenantId: tenant.id, endpoint: `/${payload.metaAdId}`, method: "POST", statusCode: 500, durationMs: Date.now() - callStart, error: err instanceof Error ? err.message : String(err) });
          throw err;
        }
        await setReelAdStatus(payload.metaAdId, "ACTIVE");
        // Cascade child→parent: first active ad activates its adset; first active
        // adset activates the campaign. (The v7 bug was activating ONLY the
        // campaign, leaving adsets+ads PAUSED → zero delivery.)
        const adsetRow = adsetsById.get(payload.locationAdsetId);
        if (adsetRow && adsetRow.status !== "ACTIVE") {
          await updateNodeStatus(adsetRow.metaAdsetId, "ACTIVE", token);
          await setLocationAdsetStatus(adsetRow.metaAdsetId, "ACTIVE");
          adsetRow.status = "ACTIVE";
        }
        if (campaignStatus !== "ACTIVE") {
          await updateNodeStatus(campaign.metaCampaignId, "ACTIVE", token);
          await setTenantCampaignStatus(tenant.id, "ACTIVE");
          campaignStatus = "ACTIVE";
        }
        await markIntentDone(intent.id);
        result.done++;
        result.created++;
        await writeAuditEvent(tenant.id, "v8_provision_activated", `Activated ad ${payload.metaAdId}`, { metaAdId: payload.metaAdId });
      } else {
        await markIntentSkipped(intent.id, `unknown creation intent ${intent.intentType}`);
        result.skipped++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await markIntentErrored(intent.id, msg);
      result.errored++;
      await writeAuditEvent(tenant.id, "v8_intent_skipped", "creation intent errored", {
        intentId: intent.id,
        error: msg.slice(0, 200),
      });
    }
  }
}

const TENANT_CONCURRENCY = 5;

async function runExecute() {
  const tenants = await getActiveTenants();
  const results: TenantExecuteResult[] = new Array(tenants.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= tenants.length) return;
      try {
        results[i] = await executeOneTenant(tenants[i]);
      } catch (err) {
        results[i] = {
          tenantId: tenants[i].id,
          drained: 0,
          done: 0,
          skipped: 0,
          errored: 0,
          created: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }
  const workers = Array.from({ length: Math.min(TENANT_CONCURRENCY, tenants.length) }, () => worker());
  await Promise.all(workers);
  return {
    tenantsProcessed: tenants.length,
    intentsDone: results.reduce((s, r) => s + r.done, 0),
    intentsSkipped: results.reduce((s, r) => s + r.skipped, 0),
    intentsErrored: results.reduce((s, r) => s + r.errored, 0),
    creationsDone: results.reduce((s, r) => s + (r.created ?? 0), 0),
    results,
  };
}

export async function GET(request: Request) {
  if (process.env.V8_ENGINE_ENABLED !== "on") {
    return NextResponse.json({ ok: false, skipped: true, reason: "v8 engine gated" });
  }
  const authError = checkCronAuth(request);
  if (authError) return authError;
  try {
    const summary = await runExecute();
    return NextResponse.json(summary);
  } catch (err) {
    console.error("v8 execute cron error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const POST = GET;
