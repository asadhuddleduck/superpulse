import type { Tenant } from "@/lib/queries/tenants";
import { createCampaign, fetchCampaigns } from "@/lib/facebook";
import {
  getTenantCampaign,
  upsertTenantCampaign,
  getLocationAdsets,
  getReelAdPairKeys,
  type TenantCampaignRow,
} from "@/lib/queries/v8";
import { getLocationsForTenant, type Location } from "@/lib/queries/locations";
import { getEligibleReelPostIds } from "@/lib/queries/posts";
import { hasRecentFailureForPost } from "@/lib/queries/api-calls";
import { planAdsetBudgets } from "@/lib/v8/budget-plan";
import {
  enqueueIntent,
  type IntentRow,
  type ProvisionAdsetPayload,
  type CreateAdPayload,
} from "@/lib/v8/intents";

// v8 provisioning lane — the PRODUCER side. Diff-based + idempotent: each tick
// recomputes "what's missing" by joining locations/ig_posts against
// location_adsets/reel_ads, then enqueues PROVISION_ADSET / CREATE_AD intents
// (deduped against already-pending intents). The execute cron is the consumer
// that does the actual Meta writes. No Meta writes here except the single
// idempotent campaign create in ensureCampaignRow.

// V8-SPEC §4: the campaign is named exactly "SuperPulse" so it sits naturally
// alongside any other campaigns the tenant runs. NOT the soak "v8 soak" name.
export const CAMPAIGN_NAME = "SuperPulse";

function stripAct(adAccountId: string): string {
  return adAccountId.startsWith("act_") ? adAccountId.slice(4) : adAccountId;
}

export interface MissingAdPair {
  locationAdsetId: number;
  metaAdsetId: string;
  postId: string;
}

/**
 * Ensure a tenant_campaigns row + Meta campaign exist. Idempotent and
 * replay-safe: reuses any existing row; if the row is absent, reuses an
 * existing PAUSED/ACTIVE "SuperPulse"-named campaign on the account (so a crash
 * between createCampaign and the DB write can't strand a second Meta campaign);
 * only creates a fresh campaign when none is found. ABO — the campaign carries
 * no Meta budget; daily_budget_pennies is a recorded total only.
 */
export async function ensureCampaignRow(tenant: Tenant): Promise<TenantCampaignRow> {
  const existing = await getTenantCampaign(tenant.id);
  if (existing?.metaCampaignId) return existing;

  if (!tenant.metaAccessToken || !tenant.adAccountId) {
    throw new Error("tenant missing meta credentials for campaign provisioning");
  }
  const token = tenant.metaAccessToken;
  const cleanAdAccountId = stripAct(tenant.adAccountId);

  let metaCampaignId: string | null = null;
  try {
    const campaigns = await fetchCampaigns(cleanAdAccountId, token);
    const match = campaigns.find(
      (c) => c.name === CAMPAIGN_NAME && (c.status === "ACTIVE" || c.status === "PAUSED"),
    );
    if (match) metaCampaignId = match.id;
  } catch {
    // Couldn't list campaigns — fall through and create one.
  }
  if (!metaCampaignId) {
    const created = await createCampaign(cleanAdAccountId, CAMPAIGN_NAME, token);
    metaCampaignId = created.id;
  }

  const locations = await getLocationsForTenant(tenant.id);
  const plan = planAdsetBudgets(tenant.monthlyAdBudgetPennies ?? 0, Math.max(1, locations.length));
  await upsertTenantCampaign({
    tenantId: tenant.id,
    metaCampaignId,
    status: "PAUSED",
    dailyBudgetPennies: plan.campaignDailyPennies,
  });
  const row = await getTenantCampaign(tenant.id);
  if (!row) throw new Error("failed to upsert tenant_campaign");
  return row;
}

/** Locations that don't yet have a location_adsets row. */
export async function findMissingAdsetLocations(
  tenantId: string,
  tenantCampaignId: number,
): Promise<Location[]> {
  const [locations, adsets] = await Promise.all([
    getLocationsForTenant(tenantId),
    getLocationAdsets(tenantCampaignId),
  ]);
  const have = new Set(adsets.map((a) => a.locationId));
  return locations.filter((l) => !have.has(l.id));
}

/**
 * (adset, post) pairs that should have an ad but don't: every EXISTING adset ×
 * every eligible Reel, minus pairs that already have a reel_ads row, minus
 * posts that recently failed (stops hot-looping on a dead post). Pairs only
 * appear once their adset exists, so creation naturally stages: adsets first,
 * then ads on the next tick.
 */
export async function findMissingAdPairs(
  tenantId: string,
  tenantCampaignId: number,
): Promise<MissingAdPair[]> {
  const adsets = await getLocationAdsets(tenantCampaignId);
  if (adsets.length === 0) return [];
  const existing = await getReelAdPairKeys(tenantCampaignId);

  const eligibleAll = await getEligibleReelPostIds(tenantId);
  const eligible: string[] = [];
  for (const postId of eligibleAll) {
    if (!(await hasRecentFailureForPost(tenantId, postId, 24))) eligible.push(postId);
  }

  const pairs: MissingAdPair[] = [];
  for (const adset of adsets) {
    for (const postId of eligible) {
      if (existing.has(`${adset.id}:${postId}`)) continue;
      pairs.push({ locationAdsetId: adset.id, metaAdsetId: adset.metaAdsetId, postId });
    }
  }
  return pairs;
}

/**
 * Enqueue missing PROVISION_ADSET / CREATE_AD intents, deduped against intents
 * already pending (so repeated provision ticks never double-queue a target).
 * Bounded by `cap` to keep the queue and the producer tick small.
 */
export async function enqueueProvisionIntents(
  tenantId: string,
  missingLocations: Location[],
  missingPairs: MissingAdPair[],
  pending: IntentRow[],
  cap: number,
): Promise<{ adsetIntentsEnqueued: number; adIntentsEnqueued: number }> {
  const pendingLocs = new Set<number>();
  const pendingPairs = new Set<string>();
  for (const i of pending) {
    if (i.intentType === "PROVISION_ADSET") {
      pendingLocs.add((i.payload as ProvisionAdsetPayload).locationId);
    } else if (i.intentType === "CREATE_AD") {
      const p = i.payload as CreateAdPayload;
      pendingPairs.add(`${p.locationAdsetId}:${p.postId}`);
    }
  }

  let enqueued = 0;
  let adsetIntentsEnqueued = 0;
  let adIntentsEnqueued = 0;

  for (const loc of missingLocations) {
    if (enqueued >= cap) break;
    if (pendingLocs.has(loc.id)) continue;
    await enqueueIntent({
      tenantId,
      aiDecisionId: null,
      intentType: "PROVISION_ADSET",
      payload: { locationId: loc.id, reason: "provision: location adset missing" },
    });
    enqueued++;
    adsetIntentsEnqueued++;
  }

  for (const pair of missingPairs) {
    if (enqueued >= cap) break;
    if (pendingPairs.has(`${pair.locationAdsetId}:${pair.postId}`)) continue;
    await enqueueIntent({
      tenantId,
      aiDecisionId: null,
      intentType: "CREATE_AD",
      payload: {
        locationAdsetId: pair.locationAdsetId,
        metaAdsetId: pair.metaAdsetId,
        postId: pair.postId,
        reason: "provision: reel ad missing",
      },
    });
    enqueued++;
    adIntentsEnqueued++;
  }

  return { adsetIntentsEnqueued, adIntentsEnqueued };
}
