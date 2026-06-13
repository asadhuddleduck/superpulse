import { NextResponse } from "next/server";
import { fetchAdInsights, verifyAd } from "@/lib/facebook";
import { checkCronAuth } from "@/lib/cron-auth";
import { getActiveTenants, type Tenant } from "@/lib/queries/tenants";
import { getActiveCampaigns } from "@/lib/queries/campaigns";
import { upsertPerformance } from "@/lib/queries/performance";
import { logApiCall } from "@/lib/queries/api-calls";
import { writeAuditEvent } from "@/lib/queries/audit-events";
import { getActiveReelAdsForTenant, getPausedReelAdsForTenant, recordReelAdRetirement } from "@/lib/queries/v8";
import { markPostIneligible } from "@/lib/queries/posts";
import { evaluateAd } from "@/lib/v8/stop-conditions";
import { enqueueIntent } from "@/lib/v8/intents";

export const maxDuration = 120;

// Per monitor tick, cap how many PAUSED ads we poll for review status so a
// large tenant doesn't blow the rate budget — the rest are polled next tick.
const MAX_REVIEW_POLLS_PER_TICK = 20;

// Map a Meta effective_status to a v8 review verdict. Ads are created PAUSED, so
// an approved ad sits in a *_PAUSED state; disapproved ads surface explicitly;
// pending ads are still in Meta's review queue.
function reviewVerdict(effectiveStatus: string): "approved" | "disapproved" | "pending" {
  const s = (effectiveStatus || "").toUpperCase();
  if (s === "DISAPPROVED" || s === "WITH_ISSUES") return "disapproved";
  if (s === "PENDING_REVIEW" || s === "IN_PROCESS" || s === "PENDING_BILLING_INFO") return "pending";
  return "approved";
}

// v8 retune (2026-05-04): the v7 inline "spend > £2 + CTR < 0.5% → pause"
// block is removed. Campaign-level performance writes are preserved (the
// dashboard StatusPanel + reconcile cron still read them). Stop conditions
// now run per-ad and enqueue STOP_AD intents into v8_intents — execute cron
// drains that queue. Net effect: monitor is read-only against Meta. All ad
// mutations flow through v8_intents → v8/execute exclusively.

interface TenantMonitorResult {
  tenantId: string;
  campaignsMonitored: number;
  reelAdsEvaluated: number;
  stopIntentsEnqueued: number;
  activateIntentsEnqueued: number;
  adsRetired: number;
  error?: string;
}

function profileVisitsFromActions(actions: Array<{ action_type: string; value: string }> | undefined): number {
  if (!actions) return 0;
  for (const a of actions) {
    if (a.action_type === "onsite_conversion.ig_profile_visit" || a.action_type === "ig_profile_visits") {
      return parseInt(a.value, 10) || 0;
    }
  }
  return 0;
}

async function processTenant(tenant: Tenant): Promise<TenantMonitorResult> {
  const result: TenantMonitorResult = {
    tenantId: tenant.id,
    campaignsMonitored: 0,
    reelAdsEvaluated: 0,
    stopIntentsEnqueued: 0,
    activateIntentsEnqueued: 0,
    adsRetired: 0,
  };

  const token = tenant.metaAccessToken;
  const adAccountId = tenant.adAccountId;
  if (!token || !adAccountId) {
    result.error = "Tenant missing Meta credentials";
    return result;
  }

  const cleanAdAccountId = adAccountId.startsWith("act_") ? adAccountId.slice(4) : adAccountId;

  const activeCampaigns = await getActiveCampaigns(tenant.id);
  const reelAds = await getActiveReelAdsForTenant(tenant.id);
  if (activeCampaigns.length === 0 && reelAds.length === 0) return result;

  // ---------- Campaign-level insights (unchanged from v7) ----------
  if (activeCampaigns.length > 0) {
    const campaignInsightsStart = Date.now();
    let campaignInsights;
    try {
      campaignInsights = await fetchAdInsights(cleanAdAccountId, token, { level: "campaign" });
      await logApiCall({
        tenantId: tenant.id,
        endpoint: `/act_${cleanAdAccountId}/insights?level=campaign`,
        method: "GET",
        statusCode: 200,
        durationMs: Date.now() - campaignInsightsStart,
      });
    } catch (err) {
      await logApiCall({
        tenantId: tenant.id,
        endpoint: `/act_${cleanAdAccountId}/insights?level=campaign`,
        method: "GET",
        statusCode: 500,
        durationMs: Date.now() - campaignInsightsStart,
        error: err instanceof Error ? err.message : String(err),
      });
      result.error = `Failed to fetch campaign insights: ${err instanceof Error ? err.message : err}`;
      return result;
    }

    const campaignInsightsMap = new Map<string, { impressions: number; reach: number; clicks: number; spend: number }>();
    for (const entry of campaignInsights) {
      if (entry.campaign_id) {
        campaignInsightsMap.set(entry.campaign_id, {
          impressions: parseInt(entry.impressions, 10) || 0,
          reach: parseInt(entry.reach, 10) || 0,
          clicks: parseInt(entry.clicks, 10) || 0,
          spend: parseFloat(entry.spend) || 0,
        });
      }
    }

    const today = new Date().toISOString().split("T")[0];
    for (const campaign of activeCampaigns) {
      const perf = campaignInsightsMap.get(campaign.metaCampaignId);
      if (!perf) continue;
      await upsertPerformance({
        campaignId: campaign.metaCampaignId,
        date: today,
        impressions: perf.impressions,
        reach: perf.reach,
        clicks: perf.clicks,
        spend: perf.spend,
        profileVisits: 0,
      });
      result.campaignsMonitored++;
    }
  }

  // ---------- Ad-level insights → STOP_AD intents (v8 addition) ----------
  if (reelAds.length === 0) return result;

  const adInsightsStart = Date.now();
  let adInsights;
  try {
    adInsights = await fetchAdInsights(cleanAdAccountId, token, { level: "ad" });
    await logApiCall({
      tenantId: tenant.id,
      endpoint: `/act_${cleanAdAccountId}/insights?level=ad`,
      method: "GET",
      statusCode: 200,
      durationMs: Date.now() - adInsightsStart,
    });
  } catch (err) {
    await logApiCall({
      tenantId: tenant.id,
      endpoint: `/act_${cleanAdAccountId}/insights?level=ad`,
      method: "GET",
      statusCode: 500,
      durationMs: Date.now() - adInsightsStart,
      error: err instanceof Error ? err.message : String(err),
    });
    return result;
  }

  const adInsightsMap = new Map<string, { impressions: number; clicks: number; spendPennies: number; profileVisits: number }>();
  for (const entry of adInsights) {
    if (!entry.ad_id) continue;
    adInsightsMap.set(entry.ad_id, {
      impressions: parseInt(entry.impressions, 10) || 0,
      clicks: parseInt(entry.clicks, 10) || 0,
      spendPennies: Math.round((parseFloat(entry.spend) || 0) * 100),
      profileVisits: profileVisitsFromActions(entry.actions),
    });
  }

  const now = Date.now();
  for (const reelAd of reelAds) {
    const perf = adInsightsMap.get(reelAd.metaAdId);
    if (!perf) continue;
    result.reelAdsEvaluated++;
    const adAgeDays = Math.floor((now - Date.parse(reelAd.addedAt)) / 86400000);
    const stop = evaluateAd(perf, adAgeDays);
    if (!stop) continue;
    try {
      const intentId = await enqueueIntent({
        tenantId: tenant.id,
        aiDecisionId: null,
        intentType: "STOP_AD",
        payload: { metaAdId: reelAd.metaAdId, reason: stop },
      });
      result.stopIntentsEnqueued++;
      await writeAuditEvent(tenant.id, "v8_intent_executed", `Enqueued STOP_AD: ${stop}`, {
        intentId,
        metaAdId: reelAd.metaAdId,
        reason: stop,
        perf,
      });
    } catch (err) {
      // enqueueIntent failure shouldn't kill the whole tenant tick.
      console.error(`enqueue STOP_AD failed for ${reelAd.metaAdId}:`, err);
    }
  }

  // ---------- Review poll → ACTIVATE_AD (v8, gated) ----------
  // PAUSED reel ads created by the provision lane are reviewed by Meta even
  // while paused. Poll their status: approved → enqueue ACTIVATE_AD (execute
  // flips PAUSED→ACTIVE with the child→parent cascade); disapproved (copyright
  // /policy) → retire + mark the post ineligible so all sibling adsets stop.
  if (process.env.V8_ENGINE_ENABLED === "on") {
    const paused = await getPausedReelAdsForTenant(tenant.id);
    let polled = 0;
    for (const reelAd of paused) {
      if (polled >= MAX_REVIEW_POLLS_PER_TICK) break;
      polled++;
      const callStart = Date.now();
      let verdict: "approved" | "disapproved" | "pending";
      try {
        const v = await verifyAd(reelAd.metaAdId, token);
        await logApiCall({ tenantId: tenant.id, endpoint: `/${reelAd.metaAdId}`, method: "GET", statusCode: 200, durationMs: Date.now() - callStart });
        verdict = reviewVerdict(v.effective_status);
      } catch (err) {
        await logApiCall({ tenantId: tenant.id, endpoint: `/${reelAd.metaAdId}`, method: "GET", statusCode: 500, durationMs: Date.now() - callStart, error: err instanceof Error ? err.message : String(err) });
        continue;
      }
      if (verdict === "pending") continue;
      if (verdict === "disapproved") {
        await recordReelAdRetirement(reelAd.metaAdId, "review_disapproved");
        await markPostIneligible(reelAd.postId, "review_disapproved");
        result.adsRetired++;
        await writeAuditEvent(tenant.id, "review_failed", `Ad ${reelAd.metaAdId} disapproved at review`, {
          metaAdId: reelAd.metaAdId,
          postId: reelAd.postId,
        });
        continue;
      }
      try {
        await enqueueIntent({
          tenantId: tenant.id,
          aiDecisionId: null,
          intentType: "ACTIVATE_AD",
          payload: { metaAdId: reelAd.metaAdId, locationAdsetId: reelAd.locationAdsetId, reason: "review passed" },
        });
        result.activateIntentsEnqueued++;
      } catch (err) {
        console.error(`enqueue ACTIVATE_AD failed for ${reelAd.metaAdId}:`, err);
      }
    }
  }

  return result;
}

// Matches scan-posts cron — keeps Meta API call rate predictable per tick.
const TENANT_CONCURRENCY = 5;

async function runMonitor() {
  const tenants = await getActiveTenants();
  const results: TenantMonitorResult[] = new Array(tenants.length);

  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= tenants.length) return;
      const tenant = tenants[i];
      try {
        results[i] = await processTenant(tenant);
      } catch (err) {
        results[i] = {
          tenantId: tenant.id,
          campaignsMonitored: 0,
          reelAdsEvaluated: 0,
          stopIntentsEnqueued: 0,
          activateIntentsEnqueued: 0,
          adsRetired: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(TENANT_CONCURRENCY, tenants.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return {
    tenantsProcessed: tenants.length,
    campaignsMonitored: results.reduce((sum, r) => sum + r.campaignsMonitored, 0),
    reelAdsEvaluated: results.reduce((sum, r) => sum + r.reelAdsEvaluated, 0),
    stopIntentsEnqueued: results.reduce((sum, r) => sum + r.stopIntentsEnqueued, 0),
    activateIntentsEnqueued: results.reduce((sum, r) => sum + r.activateIntentsEnqueued, 0),
    adsRetired: results.reduce((sum, r) => sum + r.adsRetired, 0),
    results,
  };
}

export async function GET(request: Request) {
  const authError = checkCronAuth(request);
  if (authError) return authError;
  try {
    const summary = await runMonitor();
    return NextResponse.json(summary);
  } catch (err) {
    console.error("monitor cron error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const POST = GET;
