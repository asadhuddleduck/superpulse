import { db } from "@/lib/db";
import type { Campaign } from "@/lib/types";

export interface CampaignWithLocation extends Campaign {
  locationId: number | null;
}

export async function upsertCampaign(
  campaign: Omit<Campaign, "id">,
  tenantId: string,
  locationId: number | null = null,
): Promise<void> {
  await db.execute({
    sql: `INSERT OR REPLACE INTO active_campaigns
      (tenant_id, post_id, location_id, ad_account_id, meta_campaign_id, meta_adset_id, meta_ad_id, status, daily_budget, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      tenantId,
      campaign.postId,
      locationId,
      campaign.adAccountId,
      campaign.metaCampaignId,
      campaign.metaAdsetId,
      campaign.metaAdId,
      campaign.status,
      campaign.dailyBudget,
      campaign.createdAt,
    ],
  });
}

export async function getActiveCampaigns(tenantId: string): Promise<CampaignWithLocation[]> {
  const result = await db.execute({
    sql: "SELECT * FROM active_campaigns WHERE tenant_id = ? AND status = 'ACTIVE'",
    args: [tenantId],
  });

  return result.rows.map(rowToCampaign);
}

export async function getCampaignsByTenant(tenantId: string): Promise<CampaignWithLocation[]> {
  const result = await db.execute({
    sql: "SELECT * FROM active_campaigns WHERE tenant_id = ? ORDER BY created_at DESC",
    args: [tenantId],
  });

  return result.rows.map(rowToCampaign);
}

/** Update the local DB row's status (does NOT call Meta API). */
export async function updateLocalCampaignStatus(
  metaCampaignId: string,
  status: string,
): Promise<void> {
  await db.execute({
    sql: "UPDATE active_campaigns SET status = ? WHERE meta_campaign_id = ?",
    args: [status, metaCampaignId],
  });
}

/**
 * StatusPanel-flavoured counts for a tenant: distinct posts boosted, total
 * campaigns ACTIVE, total campaigns PAUSED. Single round-trip.
 */
export async function getCampaignCounts(tenantId: string): Promise<{
  postsBoosted: number;
  campaignsLive: number;
  campaignsPaused: number;
}> {
  const result = await db.execute({
    sql: `
      SELECT
        COUNT(DISTINCT post_id) AS posts_boosted,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS campaigns_live,
        SUM(CASE WHEN status = 'PAUSED' THEN 1 ELSE 0 END) AS campaigns_paused
      FROM active_campaigns
      WHERE tenant_id = ?
    `,
    args: [tenantId],
  });
  const row = result.rows[0] ?? {};
  return {
    postsBoosted: Number(row.posts_boosted ?? 0),
    campaignsLive: Number(row.campaigns_live ?? 0),
    campaignsPaused: Number(row.campaigns_paused ?? 0),
  };
}

function rowToCampaign(row: Record<string, unknown>): CampaignWithLocation {
  return {
    id: String(row.id),
    postId: row.post_id as string,
    locationId: row.location_id == null ? null : Number(row.location_id),
    adAccountId: row.ad_account_id as string,
    metaCampaignId: row.meta_campaign_id as string,
    metaAdsetId: row.meta_adset_id as string,
    metaAdId: row.meta_ad_id as string,
    status: row.status as Campaign["status"],
    dailyBudget: row.daily_budget as number,
    createdAt: row.created_at as string,
  };
}
