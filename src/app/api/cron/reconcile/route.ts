import { NextResponse } from "next/server";
import { fetchAdInsights, fetchMe } from "@/lib/facebook";
import { checkCronAuth } from "@/lib/cron-auth";
import { getActiveTenants, type Tenant } from "@/lib/queries/tenants";
import { getActiveCampaigns } from "@/lib/queries/campaigns";
import { upsertPerformance } from "@/lib/queries/performance";
import { logApiCall } from "@/lib/queries/api-calls";
import { db } from "@/lib/db";

/**
 * Daily 4am UTC reconcile. Three jobs per active tenant:
 *
 *   1. Token health check — call /me with the stored token. 200 = healthy,
 *      anything else = log the failure so a human can re-run the OAuth flow.
 *      We do NOT attempt to auto-refresh: the fb_exchange_token endpoint is
 *      for short→long, not long→long. Marketing API Standard Access tokens
 *      may not expire on a fixed schedule anyway. Reactive replacement via
 *      OAuth is more reliable than proactive auto-refresh until we have
 *      data on real-world expiry behaviour.
 *   2. Yesterday's perf snapshot — fetch `date_preset=yesterday` insights and
 *      upsert into `performance_data`. The 6-hourly monitor cron writes today's
 *      running totals; this locks in yesterday's *final* numbers in case the
 *      last 6h tick missed the closing minutes around London midnight.
 *   3. Stale-paused count — flag (log only, no auto-delete) campaigns that
 *      have been PAUSED for >14 days. A human reviews before any cleanup.
 *
 * Concurrency mirrors scan-posts/monitor: 5-wide worker pool keeps Meta API
 * volume predictable per tick.
 */

const STALE_PAUSED_THRESHOLD_DAYS = 14;
const TENANT_CONCURRENCY = 5;

interface TenantReconcileResult {
  tenantId: string;
  tokenHealthy: boolean;
  perfSnapshotted: number;
  error?: string;
}

function yesterdayISODate(): string {
  // London timezone YYYY-MM-DD for yesterday — matches scan-posts' "today" semantics.
  const now = new Date();
  const ymdToday = now.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const todayUTC = new Date(`${ymdToday}T00:00:00Z`);
  const yesterdayUTC = new Date(todayUTC.getTime() - 24 * 60 * 60 * 1000);
  return yesterdayUTC.toISOString().split("T")[0];
}

async function checkTokenHealth(tenant: Tenant): Promise<boolean> {
  if (!tenant.metaAccessToken) return false;
  const start = Date.now();
  try {
    await fetchMe(tenant.metaAccessToken);
    await logApiCall({
      tenantId: tenant.id,
      endpoint: `/me (token health)`,
      method: "GET",
      statusCode: 200,
      durationMs: Date.now() - start,
    });
    return true;
  } catch (err) {
    await logApiCall({
      tenantId: tenant.id,
      endpoint: `/me (token health)`,
      method: "GET",
      statusCode: 401,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

async function snapshotYesterday(tenant: Tenant, yesterday: string): Promise<number> {
  if (!tenant.adAccountId || !tenant.metaAccessToken) return 0;

  const cleanAdAccountId = tenant.adAccountId.startsWith("act_")
    ? tenant.adAccountId.slice(4)
    : tenant.adAccountId;

  const activeCampaigns = await getActiveCampaigns(tenant.id);
  if (activeCampaigns.length === 0) return 0;

  const start = Date.now();
  let insights;
  try {
    insights = await fetchAdInsights(cleanAdAccountId, tenant.metaAccessToken, {
      datePreset: "yesterday",
    });
    await logApiCall({
      tenantId: tenant.id,
      endpoint: `/act_${cleanAdAccountId}/insights?date_preset=yesterday`,
      method: "GET",
      statusCode: 200,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    await logApiCall({
      tenantId: tenant.id,
      endpoint: `/act_${cleanAdAccountId}/insights?date_preset=yesterday`,
      method: "GET",
      statusCode: 500,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  const insightsByCampaign = new Map<string, typeof insights[number]>();
  for (const entry of insights) {
    if (entry.campaign_id) insightsByCampaign.set(entry.campaign_id, entry);
  }

  let snapshotted = 0;
  for (const campaign of activeCampaigns) {
    const perf = insightsByCampaign.get(campaign.metaCampaignId);
    if (!perf) continue;
    await upsertPerformance({
      campaignId: campaign.metaCampaignId,
      date: yesterday,
      impressions: parseInt(perf.impressions, 10) || 0,
      reach: parseInt(perf.reach, 10) || 0,
      clicks: parseInt(perf.clicks, 10) || 0,
      spend: parseFloat(perf.spend) || 0,
      profileVisits: 0,
    });
    snapshotted++;
  }
  return snapshotted;
}

async function processTenant(tenant: Tenant, yesterday: string): Promise<TenantReconcileResult> {
  const result: TenantReconcileResult = {
    tenantId: tenant.id,
    tokenHealthy: false,
    perfSnapshotted: 0,
  };

  result.tokenHealthy = await checkTokenHealth(tenant);
  if (!result.tokenHealthy) {
    result.error = "Token health check failed — token is dead, tenant needs to re-OAuth";
    // Skip the perf snapshot — it would fail with the same dead token.
    return result;
  }

  try {
    result.perfSnapshotted = await snapshotYesterday(tenant, yesterday);
  } catch (err) {
    result.error = `Perf snapshot failed: ${err instanceof Error ? err.message : err}`;
  }

  return result;
}

async function countStalePaused(): Promise<{ count: number; ids: string[] }> {
  const cutoff = new Date(
    Date.now() - STALE_PAUSED_THRESHOLD_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const result = await db.execute({
    sql: `SELECT meta_campaign_id FROM active_campaigns
          WHERE status = 'PAUSED' AND created_at < ?`,
    args: [cutoff],
  });
  const ids = result.rows.map((r) => String(r.meta_campaign_id));
  return { count: ids.length, ids };
}

async function runReconcile() {
  const yesterday = yesterdayISODate();
  const tenants = await getActiveTenants();
  const results: TenantReconcileResult[] = new Array(tenants.length);

  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= tenants.length) return;
      const tenant = tenants[i];
      try {
        results[i] = await processTenant(tenant, yesterday);
      } catch (err) {
        results[i] = {
          tenantId: tenant.id,
          tokenHealthy: false,
          perfSnapshotted: 0,
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

  const stale = await countStalePaused();

  const unhealthyTokens = results
    .filter((r) => r && !r.tokenHealthy)
    .map((r) => r.tenantId);

  if (unhealthyTokens.length > 0) {
    console.error(
      `[reconcile] Tenants with dead tokens (need OAuth re-auth):`,
      unhealthyTokens,
    );
  }
  if (stale.count > 0) {
    console.warn(
      `[reconcile] ${stale.count} stale-paused campaigns (>14d):`,
      stale.ids,
    );
  }

  return {
    yesterday,
    tenantsProcessed: tenants.length,
    tokensHealthy: results.filter((r) => r?.tokenHealthy).length,
    unhealthyTokens,
    perfSnapshotted: results.reduce((sum, r) => sum + (r?.perfSnapshotted ?? 0), 0),
    stalePausedCount: stale.count,
    stalePausedIds: stale.ids,
    results,
  };
}

export async function GET(request: Request) {
  const authError = checkCronAuth(request);
  if (authError) return authError;
  try {
    const summary = await runReconcile();
    return NextResponse.json(summary);
  } catch (err) {
    console.error("reconcile cron error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// Manual trigger parity with scan-posts/monitor.
export const POST = GET;
