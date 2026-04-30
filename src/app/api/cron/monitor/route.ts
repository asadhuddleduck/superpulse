import { NextResponse } from "next/server";
import {
  fetchAdInsights,
  updateCampaignStatus as updateMetaCampaignStatus,
} from "@/lib/facebook";
import { checkCronAuth } from "@/lib/cron-auth";
import { getActiveTenants, type Tenant } from "@/lib/queries/tenants";
import {
  getActiveCampaigns,
  updateLocalCampaignStatus,
} from "@/lib/queries/campaigns";
import { upsertPerformance } from "@/lib/queries/performance";
import { logApiCall } from "@/lib/queries/api-calls";
import { writeAuditEvent } from "@/lib/queries/audit-events";

interface TenantMonitorResult {
  tenantId: string;
  monitored: number;
  paused: string[];
  error?: string;
}

async function processTenant(tenant: Tenant): Promise<TenantMonitorResult> {
  const result: TenantMonitorResult = {
    tenantId: tenant.id,
    monitored: 0,
    paused: [],
  };

  const token = tenant.metaAccessToken;
  const adAccountId = tenant.adAccountId;
  if (!token || !adAccountId) {
    result.error = "Tenant missing Meta credentials";
    return result;
  }

  const cleanAdAccountId = adAccountId.startsWith("act_")
    ? adAccountId.slice(4)
    : adAccountId;

  const activeCampaigns = await getActiveCampaigns(tenant.id);
  if (activeCampaigns.length === 0) return result;

  const insightsStart = Date.now();
  let insights;
  try {
    insights = await fetchAdInsights(cleanAdAccountId, token);
    await logApiCall({
      tenantId: tenant.id,
      endpoint: `/act_${cleanAdAccountId}/insights`,
      method: "GET",
      statusCode: 200,
      durationMs: Date.now() - insightsStart,
    });
  } catch (err) {
    await logApiCall({
      tenantId: tenant.id,
      endpoint: `/act_${cleanAdAccountId}/insights`,
      method: "GET",
      statusCode: 500,
      durationMs: Date.now() - insightsStart,
      error: err instanceof Error ? err.message : String(err),
    });
    result.error = `Failed to fetch insights: ${err instanceof Error ? err.message : err}`;
    return result;
  }

  const insightsMap = new Map<string, {
    impressions: number;
    reach: number;
    clicks: number;
    spend: number;
  }>();
  for (const entry of insights) {
    if (entry.campaign_id) {
      insightsMap.set(entry.campaign_id, {
        impressions: parseInt(entry.impressions, 10) || 0,
        reach: parseInt(entry.reach, 10) || 0,
        clicks: parseInt(entry.clicks, 10) || 0,
        spend: parseFloat(entry.spend) || 0,
      });
    }
  }

  const today = new Date().toISOString().split("T")[0];

  for (const campaign of activeCampaigns) {
    const perf = insightsMap.get(campaign.metaCampaignId);
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
    result.monitored++;

    // Underperformer rule: spend > £2 and CTR < 0.5% → pause.
    const ctr = perf.impressions > 0 ? perf.clicks / perf.impressions : 0;
    if (perf.spend > 2.0 && ctr < 0.005) {
      const pauseStart = Date.now();
      try {
        await updateMetaCampaignStatus(campaign.metaCampaignId, "PAUSED", token);
        await logApiCall({
          tenantId: tenant.id,
          endpoint: `/${campaign.metaCampaignId}`,
          method: "POST",
          statusCode: 200,
          durationMs: Date.now() - pauseStart,
        });
        await updateLocalCampaignStatus(campaign.metaCampaignId, "PAUSED");
        result.paused.push(campaign.metaCampaignId);
        await writeAuditEvent(
          tenant.id,
          "spend_threshold",
          `Paused underperforming campaign — spent £${perf.spend.toFixed(2)} with low CTR`,
          { metaCampaignId: campaign.metaCampaignId, spend: perf.spend, ctr },
        );
      } catch (err) {
        await logApiCall({
          tenantId: tenant.id,
          endpoint: `/${campaign.metaCampaignId}`,
          method: "POST",
          statusCode: 500,
          durationMs: Date.now() - pauseStart,
          error: err instanceof Error ? err.message : String(err),
        });
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
          monitored: 0,
          paused: [],
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
    totalMonitored: results.reduce((sum, r) => sum + r.monitored, 0),
    totalPaused: results.reduce((sum, r) => sum + r.paused.length, 0),
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
