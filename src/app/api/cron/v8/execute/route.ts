import { NextResponse } from "next/server";
import {
  updateAdSetDailyBudget,
  updateNodeStatus,
  createAdSet,
  createAdCreative,
  createAd,
  fetchAdSets,
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
import {
  provisionAdsetsBatch,
  type AdSetProvisionSpec,
  type AdSetProvisionOutcome,
} from "@/lib/v8/batch-provision";
import { classifyMetaError } from "@/lib/meta-errors";
import { markPostIneligible } from "@/lib/queries/posts";
import { logApiCall } from "@/lib/queries/api-calls";
import { writeAuditEvent } from "@/lib/queries/audit-events";

// v8 execute cron — 30-min cadence. The SINGLE Meta-mutation consumer. Two
// independent drain lanes per tenant:
//   - STEADY-STATE: up to 3 BUDGET_TILT/STOP_AD intents. Re-validates tilts vs
//     fresh adset state via applyTilts (3× spread + 24h cooldown), applies
//     STOP_AD via updateNodeStatus + recordReelAdRetirement.
//   - CREATION: PROVISION_ADSET/CREATE_AD/ACTIVATE_AD intents — creates
//     adsets/ads PAUSED, activates after review (child→parent cascade). Drains 8
//     per tick steady-state, more for a tenant in its initial build (see
//     MAX_CREATION_PER_TICK_BUILD), gated by the breaker's headroom.
// Shared per-app circuit breaker gates both. Everything is created PAUSED;
// activation is a separate ACTIVATE_AD step enqueued by the monitor review poll.

export const maxDuration = 60;

const MAX_INTENTS_PER_TICK = 3;
const MAX_CREATION_PER_TICK = 8;
// Initial-build burst drain. A fresh multi-location tenant has hundreds-to-
// thousands of creation intents (N adsets + N×reels ads + activations); at the
// steady-state 8/tick that first build takes days. While a tenant is still in
// its initial build (provisioning_status='provisioning') AND the app breaker has
// ample headroom we drain a larger batch so the account goes live in hours.
// Bounded by: the per-app circuit breaker (re-read every tick, halts the
// creation lane at >35%) and maxDuration=60s (≤ ~2 Meta calls per CREATE_AD).
// Safe against a timed-out tick because every creation step is replay-safe
// (PROVISION_ADSET reuse guard + reelAdExists + idempotent ACTIVATE_AD).
const MAX_CREATION_PER_TICK_BUILD = 30;

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
    // Burst the drain for tenants still in their initial build, but only while
    // the app breaker has ample headroom (peak well under the creation halt) so
    // a steady-state account never gets a surprise burst.
    const creationLimit =
      tenant.provisioningStatus === "provisioning" && breaker.peak < CREATION_BREAKER_THRESHOLD / 2
        ? MAX_CREATION_PER_TICK_BUILD
        : MAX_CREATION_PER_TICK;
    await processCreationIntents(tenant, token, tenantCampaign, adsets, adsetsByMetaId, result, creationLimit);
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
  creationLimit: number,
): Promise<void> {
  const adAccountId = tenant.adAccountId;
  if (!adAccountId || !tenant.pageId || !tenant.igUserId || !tenant.igUsername) return;
  const cleanAdAccountId = adAccountId.startsWith("act_") ? adAccountId.slice(4) : adAccountId;

  const intents = await drainPendingCreationIntents(tenant.id, creationLimit);
  if (intents.length === 0) return;
  result.drained += intents.length;

  const locations = await getLocationsForTenant(tenant.id);
  const locationsById = new Map<number, Location>(locations.map((l) => [l.id, l]));
  const adsetsById = new Map<number, LocationAdsetRow>(adsets.map((a) => [a.id, a]));
  const plan = planAdsetBudgets(tenant.monthlyAdBudgetPennies ?? 0, Math.max(1, locations.length));
  let campaignStatus = campaign.status;

  // ---- Budget drift fix (location-add) ----
  // When NEW location adsets are being provisioned this tick, the even per-adset
  // split (plan.perAdsetDailyPennies) drops because N grew. New adsets get the
  // new split, but adsets created under the OLD (smaller) N still carry the OLD,
  // larger per-adset budget — so total live daily spend drifts ABOVE the
  // approved monthly budget (e.g. 1 adset @ £10 + 4 new @ £2 = £18/day vs the
  // £10/day the £304/mo buys). Re-baseline every EXISTING adset to the new even
  // split so the campaign total tracks monthly_ad_budget_pennies. Only runs on
  // ticks that add adsets (steady-state CREATE_AD-only ticks leave LLM tilts
  // alone); best-effort so a single PATCH miss doesn't fail the creation tick.
  if (intents.some((i) => i.intentType === "PROVISION_ADSET")) {
    for (const adset of adsets) {
      if (adset.dailyBudgetPennies === plan.perAdsetDailyPennies) continue;
      const reCallStart = Date.now();
      try {
        await updateAdSetDailyBudget(adset.metaAdsetId, plan.perAdsetDailyPennies, token);
        await logApiCall({ tenantId: tenant.id, endpoint: `/${adset.metaAdsetId}`, method: "POST", statusCode: 200, durationMs: Date.now() - reCallStart });
        await recordAdsetBudgetWrite(adset.metaAdsetId, plan.perAdsetDailyPennies);
        const oldPennies = adset.dailyBudgetPennies;
        adset.dailyBudgetPennies = plan.perAdsetDailyPennies;
        const cached = adsetsByMetaId.get(adset.metaAdsetId);
        if (cached) cached.dailyBudgetPennies = plan.perAdsetDailyPennies;
        await writeAuditEvent(tenant.id, "v8_intent_executed", "Adset budget re-baselined on location add", { metaAdsetId: adset.metaAdsetId, oldPennies, newPennies: plan.perAdsetDailyPennies, locations: locations.length });
      } catch (err) {
        await logApiCall({ tenantId: tenant.id, endpoint: `/${adset.metaAdsetId}`, method: "POST", statusCode: 500, durationMs: Date.now() - reCallStart, error: err instanceof Error ? err.message : String(err) });
        // best-effort: leave this adset for the next provision tick to retry
      }
    }
  }

  // Flag-gated Batch-API pre-pass (V8_BATCH_CREATION). OFF by default → returns
  // null and the single-call loop below runs over ALL intents, byte-identical to
  // the proven path. ON → PROVISION_ADSET intents are created in one Batch
  // request, their DB writes done here, and they are excluded from the loop;
  // CREATE_AD/ACTIVATE_AD always stay single-call (creative/identity + cascade
  // ordering don't batch). Unvalidated against live Meta until the soak.
  const batchedIntentIds = await maybeBatchProvisionAdsets(
    intents,
    tenant,
    token,
    campaign,
    adAccountId,
    locationsById,
    plan,
    adsetsByMetaId,
    result,
  );
  const loopIntents = batchedIntentIds
    ? intents.filter((i) => !batchedIntentIds.has(i.id))
    : intents;

  // PROVISION_ADSET idempotency guard (mirrors ensureCampaignRow's campaign
  // reuse). A prior tick can create the Meta ad set then crash/time out before
  // upsertLocationAdset, leaving no DB row — so the location still looks
  // "missing" and gets re-enqueued. Without a pre-create existence check the
  // retry mints a SECOND orphan ad set. Fetch the campaign's existing ad sets
  // once and adopt any 'SuperPulse | {loc}' match instead of recreating it.
  // Lazy (only when a PROVISION_ADSET is in this drain) + best-effort (a failed
  // list falls through to create, same as the campaign-reuse path).
  const existingAdsetIdByName = new Map<string, string>();
  if (loopIntents.some((i) => i.intentType === "PROVISION_ADSET")) {
    try {
      const metaAdsets = await fetchAdSets(campaign.metaCampaignId, token);
      for (const a of metaAdsets) {
        if (a.status === "ACTIVE" || a.status === "PAUSED") existingAdsetIdByName.set(a.name, a.id);
      }
    } catch {
      // Couldn't list ad sets — fall through and create (orphan risk reverts to
      // pre-fix behaviour for this tick only).
    }
  }

  for (const intent of loopIntents) {
    try {
      if (intent.intentType === "PROVISION_ADSET") {
        const payload = intent.payload as ProvisionAdsetPayload;
        const loc = locationsById.get(payload.locationId);
        if (!loc) {
          await markIntentSkipped(intent.id, `location ${payload.locationId} gone`);
          result.skipped++;
          continue;
        }
        const adsetName = `SuperPulse | ${loc.name}`;
        let metaAdsetId: string;
        const reusedAdsetId = existingAdsetIdByName.get(adsetName);
        if (reusedAdsetId) {
          // Adopt the ad set a prior tick stranded on Meta instead of minting a duplicate.
          metaAdsetId = reusedAdsetId;
        } else {
          const callStart = Date.now();
          try {
            const adset = await createAdSet(
              campaign.metaCampaignId,
              cleanAdAccountId,
              adsetName,
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
        await writeAuditEvent(tenant.id, "v8_provision_adset_created", `Ad set ${reusedAdsetId ? "reused (idempotent replay)" : "created"} for ${loc.name}`, { metaAdsetId, locationId: loc.id, reused: !!reusedAdsetId });
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

// Flag-gated Batch-API provisioning for PROVISION_ADSET intents. Returns the set
// of intent ids it has fully handled (done/skipped/errored) so the caller's
// single-call loop skips them; returns null when the flag is OFF so the loop runs
// unchanged. The success-side DB writes mirror the single-call PROVISION_ADSET
// branch exactly (upsert → guardrails → cache → done → audit). On a whole-batch
// rejection the un-skipped intents are left for the single-call loop to retry.
// NOTE: throughput is still bounded by MAX_CREATION_PER_TICK on the drain; raise
// that during a soak to let one Batch request carry more than a handful of ops.
async function maybeBatchProvisionAdsets(
  intents: IntentRow[],
  tenant: Tenant,
  token: string,
  campaign: TenantCampaignRow,
  adAccountId: string,
  locationsById: Map<number, Location>,
  plan: ReturnType<typeof planAdsetBudgets>,
  adsetsByMetaId: Map<string, LocationAdsetRow>,
  result: TenantExecuteResult,
): Promise<Set<number> | null> {
  if (process.env.V8_BATCH_CREATION !== "on") return null;
  if (!tenant.pageId) return null;
  const provision = intents.filter((i) => i.intentType === "PROVISION_ADSET");
  if (provision.length < 2) return null; // 0-1 adsets → no batch win; let the loop do it
  const cleanAdAccountId = adAccountId.startsWith("act_") ? adAccountId.slice(4) : adAccountId;

  const handled = new Set<number>();
  const specs: AdSetProvisionSpec[] = [];
  for (const intent of provision) {
    const payload = intent.payload as ProvisionAdsetPayload;
    const loc = locationsById.get(payload.locationId);
    if (!loc) {
      await markIntentSkipped(intent.id, `location ${payload.locationId} gone`);
      result.skipped++;
      handled.add(intent.id);
      continue;
    }
    specs.push({
      intentId: intent.id,
      locationId: loc.id,
      campaignId: campaign.metaCampaignId,
      name: `SuperPulse | ${loc.name}`,
      dailyBudgetPounds: plan.perAdsetDailyPennies / 100,
      radiusMiles: loc.radiusMiles,
      lat: loc.latitude,
      lng: loc.longitude,
      pageId: tenant.pageId,
    });
  }
  if (specs.length === 0) return handled;

  let outcomes: AdSetProvisionOutcome[];
  const callStart = Date.now();
  try {
    outcomes = await provisionAdsetsBatch(specs, adAccountId, token);
  } catch (err) {
    // Whole-batch rejection (auth/malformed). Don't claim these intents — leave
    // them for the single-call loop to retry this tick so one bad batch can't
    // stall provisioning.
    await writeAuditEvent(tenant.id, "v8_intent_skipped", "adset batch rejected, falling back to single-call", {
      error: (err instanceof Error ? err.message : String(err)).slice(0, 200),
      count: specs.length,
    });
    return handled; // only the missing-location skips; specs fall through to the loop
  }

  const durationMs = Date.now() - callStart;
  for (const o of outcomes) {
    handled.add(o.intentId);
    await logApiCall({
      tenantId: tenant.id,
      endpoint: `/act_${cleanAdAccountId}/adsets`,
      method: "POST",
      statusCode: o.ok ? 200 : 500,
      durationMs,
      error: o.ok ? undefined : o.error ?? undefined,
    });
    if (o.ok && o.metaAdsetId) {
      await upsertLocationAdset({ tenantCampaignId: campaign.id, locationId: o.locationId, metaAdsetId: o.metaAdsetId, status: "PAUSED", dailyBudgetPennies: plan.perAdsetDailyPennies });
      await recordAdsetGuardrails(o.metaAdsetId, plan.minDailyBudgetPennies, plan.maxDailyBudgetPennies);
      adsetsByMetaId.set(o.metaAdsetId, {
        id: 0,
        tenantCampaignId: campaign.id,
        locationId: o.locationId,
        metaAdsetId: o.metaAdsetId,
        status: "PAUSED",
        dailyBudgetPennies: plan.perAdsetDailyPennies,
        minDailyBudgetPennies: plan.minDailyBudgetPennies,
        maxDailyBudgetPennies: plan.maxDailyBudgetPennies,
        currentSpendTodayPennies: 0,
        lastGuardrailWriteAt: null,
        createdAt: new Date().toISOString(),
      });
      await markIntentDone(o.intentId);
      result.done++;
      result.created++;
      await writeAuditEvent(tenant.id, "v8_provision_adset_created", `Ad set created (batch) for location ${o.locationId}`, { metaAdsetId: o.metaAdsetId, locationId: o.locationId, batch: true });
    } else {
      // Per-op failure → mark errored; the provision cron re-enqueues next tick.
      await markIntentErrored(o.intentId, o.error ?? "adset batch op failed");
      result.errored++;
      await writeAuditEvent(tenant.id, "v8_intent_skipped", "adset batch op failed", { intentId: o.intentId, locationId: o.locationId, error: (o.error ?? "").slice(0, 200) });
    }
  }
  return handled;
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
