import { db } from "@/lib/db";
import type { CampaignPerformance } from "@/lib/types";

export async function upsertPerformance(data: CampaignPerformance): Promise<void> {
  await db.execute({
    sql: `INSERT OR REPLACE INTO performance_data
      (campaign_id, date, impressions, reach, clicks, spend, profile_visits)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.campaignId,
      data.date,
      data.impressions,
      data.reach,
      data.clicks,
      data.spend,
      data.profileVisits,
    ],
  });
}

export async function getPerformanceByCampaign(
  campaignId: string
): Promise<CampaignPerformance[]> {
  const result = await db.execute({
    sql: "SELECT * FROM performance_data WHERE campaign_id = ? ORDER BY date DESC",
    args: [campaignId],
  });

  return result.rows.map(rowToPerformance);
}

export async function getAggregatePerformance(
  tenantId: string
): Promise<{
  totalSpend: number;
  totalImpressions: number;
  totalProfileVisits: number;
  activeCampaigns: number;
}> {
  const result = await db.execute({
    sql: `SELECT
      COALESCE(SUM(pd.spend), 0) AS total_spend,
      COALESCE(SUM(pd.impressions), 0) AS total_impressions,
      COALESCE(SUM(pd.profile_visits), 0) AS total_profile_visits,
      COUNT(DISTINCT CASE WHEN ac.status = 'ACTIVE' THEN ac.meta_campaign_id END) AS active_campaigns
    FROM active_campaigns ac
    LEFT JOIN performance_data pd ON CAST(ac.id AS TEXT) = pd.campaign_id
    WHERE ac.tenant_id = ?`,
    args: [tenantId],
  });

  const row = result.rows[0];
  return {
    totalSpend: (row.total_spend as number) ?? 0,
    totalImpressions: (row.total_impressions as number) ?? 0,
    totalProfileVisits: (row.total_profile_visits as number) ?? 0,
    activeCampaigns: (row.active_campaigns as number) ?? 0,
  };
}

function rowToPerformance(row: Record<string, unknown>): CampaignPerformance {
  return {
    campaignId: row.campaign_id as string,
    date: row.date as string,
    impressions: row.impressions as number,
    reach: row.reach as number,
    clicks: row.clicks as number,
    spend: row.spend as number,
    profileVisits: row.profile_visits as number,
  };
}
