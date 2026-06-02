import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/auth";
import { countPostsByTenant } from "@/lib/queries/posts";
import { getCampaignCounts } from "@/lib/queries/campaigns";
import { getAggregatePerformance } from "@/lib/queries/performance";
import {
  getLastSuccessfulCallByEndpoint,
  getRecentErrorForTenant,
} from "@/lib/queries/api-calls";
import { getRecentEvents } from "@/lib/queries/audit-events";
import { getProvisioningProgress } from "@/lib/queries/v8";

export const dynamic = "force-dynamic";

type Health = "green" | "yellow" | "red";

function computeHealth(
  scanLastRun: string | null,
  hasRecentError: boolean,
): Health {
  if (!scanLastRun) return "red";
  const ageMs = Date.now() - new Date(scanLastRun).getTime();
  const hours = ageMs / (60 * 60 * 1000);
  if (hours > 12) return "red";
  if (hours > 3 || hasRecentError) return "yellow";
  return "green";
}

export async function GET() {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const [
    postsDetected,
    campaignCounts,
    perf,
    scanLastRun,
    lastError,
    recentActivity,
    provisioningProgress,
  ] = await Promise.all([
    countPostsByTenant(tenant.id),
    getCampaignCounts(tenant.id),
    getAggregatePerformance(tenant.id),
    getLastSuccessfulCallByEndpoint(tenant.id, "%/media%"),
    getRecentErrorForTenant(tenant.id),
    getRecentEvents(tenant.id, 10),
    getProvisioningProgress(tenant.id),
  ]);

  const health = computeHealth(scanLastRun, lastError !== null);

  return NextResponse.json({
    scanLastRun,
    postsDetected,
    postsBoosted: campaignCounts.postsBoosted,
    campaignsLive: campaignCounts.campaignsLive,
    campaignsPaused: campaignCounts.campaignsPaused,
    spendToDate: perf.totalSpend,
    profileVisits: perf.totalProfileVisits,
    impressions: perf.totalImpressions,
    lastError,
    health,
    // v8: honest provisioning status. null for v7/legacy tenants (no v8 campaign).
    provisioning: provisioningProgress
      ? { state: tenant.provisioningStatus, ...provisioningProgress }
      : null,
    recentActivity: recentActivity.map((e) => ({
      eventType: e.eventType,
      message: e.message,
      createdAt: e.createdAt,
    })),
  });
}
