import { db } from "@/lib/db";

// Typed query helpers for the four v8 tables (tenant_campaigns, location_adsets,
// reel_ads, ai_decisions). Mirrors the lazy-proxy + INSERT ... ON CONFLICT
// DO UPDATE pattern used in src/lib/queries/tenants.ts and src/lib/queries/posts.ts.

// ---------------------------------------------------------------------------
// tenant_campaigns
// ---------------------------------------------------------------------------

export interface TenantCampaignRow {
  id: number;
  tenantId: string;
  metaCampaignId: string;
  status: string;
  dailyBudgetPennies: number;
  cboEnabled: boolean;
  spendCapPennies: number | null;
  createdAt: string;
  updatedAt: string;
}

function rowToTenantCampaign(row: Record<string, unknown>): TenantCampaignRow {
  return {
    id: Number(row.id),
    tenantId: row.tenant_id as string,
    metaCampaignId: row.meta_campaign_id as string,
    status: row.status as string,
    dailyBudgetPennies: Number(row.daily_budget_pennies),
    cboEnabled: Number(row.cbo_enabled) === 1,
    spendCapPennies: row.spend_cap_pennies == null ? null : Number(row.spend_cap_pennies),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function upsertTenantCampaign(input: {
  tenantId: string;
  metaCampaignId: string;
  status?: string;
  dailyBudgetPennies: number;
  spendCapPennies?: number | null;
}): Promise<void> {
  await db.execute({
    sql: `INSERT INTO tenant_campaigns
      (tenant_id, meta_campaign_id, status, daily_budget_pennies, spend_cap_pennies)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id) DO UPDATE SET
        meta_campaign_id     = excluded.meta_campaign_id,
        status               = excluded.status,
        daily_budget_pennies = excluded.daily_budget_pennies,
        spend_cap_pennies    = COALESCE(excluded.spend_cap_pennies, tenant_campaigns.spend_cap_pennies),
        updated_at           = CURRENT_TIMESTAMP
    `,
    args: [
      input.tenantId,
      input.metaCampaignId,
      input.status ?? "PAUSED",
      input.dailyBudgetPennies,
      input.spendCapPennies ?? null,
    ],
  });
}

export async function getTenantCampaign(tenantId: string): Promise<TenantCampaignRow | null> {
  const res = await db.execute({
    sql: `SELECT * FROM tenant_campaigns WHERE tenant_id = ? LIMIT 1`,
    args: [tenantId],
  });
  if (!res.rows.length) return null;
  return rowToTenantCampaign(res.rows[0] as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// location_adsets
// ---------------------------------------------------------------------------

export interface LocationAdsetRow {
  id: number;
  tenantCampaignId: number;
  locationId: number;
  metaAdsetId: string;
  status: string;
  dailyBudgetPennies: number | null;
  minDailyBudgetPennies: number | null;
  maxDailyBudgetPennies: number | null;
  currentSpendTodayPennies: number;
  lastGuardrailWriteAt: string | null;
  createdAt: string;
}

function rowToLocationAdset(row: Record<string, unknown>): LocationAdsetRow {
  return {
    id: Number(row.id),
    tenantCampaignId: Number(row.tenant_campaign_id),
    locationId: Number(row.location_id),
    metaAdsetId: row.meta_adset_id as string,
    status: row.status as string,
    dailyBudgetPennies: row.daily_budget_pennies == null ? null : Number(row.daily_budget_pennies),
    minDailyBudgetPennies: row.min_daily_budget_pennies == null ? null : Number(row.min_daily_budget_pennies),
    maxDailyBudgetPennies: row.max_daily_budget_pennies == null ? null : Number(row.max_daily_budget_pennies),
    currentSpendTodayPennies: Number(row.current_spend_today_pennies ?? 0),
    lastGuardrailWriteAt: (row.last_guardrail_write_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function upsertLocationAdset(input: {
  tenantCampaignId: number;
  locationId: number;
  metaAdsetId: string;
  status?: string;
  dailyBudgetPennies?: number | null;
}): Promise<void> {
  await db.execute({
    sql: `INSERT INTO location_adsets
      (tenant_campaign_id, location_id, meta_adset_id, status, daily_budget_pennies)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(tenant_campaign_id, location_id) DO UPDATE SET
        meta_adset_id        = excluded.meta_adset_id,
        status               = excluded.status,
        daily_budget_pennies = COALESCE(excluded.daily_budget_pennies, location_adsets.daily_budget_pennies)
    `,
    args: [
      input.tenantCampaignId,
      input.locationId,
      input.metaAdsetId,
      input.status ?? "PAUSED",
      input.dailyBudgetPennies ?? null,
    ],
  });
}

export async function getLocationAdsets(tenantCampaignId: number): Promise<LocationAdsetRow[]> {
  const res = await db.execute({
    sql: `SELECT * FROM location_adsets WHERE tenant_campaign_id = ? ORDER BY id`,
    args: [tenantCampaignId],
  });
  return res.rows.map((r) => rowToLocationAdset(r as unknown as Record<string, unknown>));
}

// Stamps last_guardrail_write_at = NOW for the 24h cooldown.
export async function recordAdsetBudgetWrite(metaAdsetId: string, newDailyBudgetPennies: number): Promise<void> {
  await db.execute({
    sql: `UPDATE location_adsets
            SET daily_budget_pennies   = ?,
                last_guardrail_write_at = CURRENT_TIMESTAMP
          WHERE meta_adset_id = ?`,
    args: [newDailyBudgetPennies, metaAdsetId],
  });
}

// ---------------------------------------------------------------------------
// reel_ads
// ---------------------------------------------------------------------------

export interface ReelAdRow {
  id: number;
  locationAdsetId: number;
  postId: string;
  metaAdId: string;
  metaCreativeId: string | null;
  status: string;
  aiScore: number | null;
  addedAt: string;
  retiredAt: string | null;
  retiredReason: string | null;
}

function rowToReelAd(row: Record<string, unknown>): ReelAdRow {
  return {
    id: Number(row.id),
    locationAdsetId: Number(row.location_adset_id),
    postId: row.post_id as string,
    metaAdId: row.meta_ad_id as string,
    metaCreativeId: (row.meta_creative_id as string | null) ?? null,
    status: row.status as string,
    aiScore: row.ai_score == null ? null : Number(row.ai_score),
    addedAt: row.added_at as string,
    retiredAt: (row.retired_at as string | null) ?? null,
    retiredReason: (row.retired_reason as string | null) ?? null,
  };
}

export async function upsertReelAd(input: {
  locationAdsetId: number;
  postId: string;
  metaAdId: string;
  metaCreativeId?: string | null;
  status?: string;
  aiScore?: number | null;
}): Promise<void> {
  await db.execute({
    sql: `INSERT INTO reel_ads
      (location_adset_id, post_id, meta_ad_id, meta_creative_id, status, ai_score)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(location_adset_id, post_id) DO UPDATE SET
        meta_ad_id       = excluded.meta_ad_id,
        meta_creative_id = COALESCE(excluded.meta_creative_id, reel_ads.meta_creative_id),
        status           = excluded.status,
        ai_score         = COALESCE(excluded.ai_score, reel_ads.ai_score)
    `,
    args: [
      input.locationAdsetId,
      input.postId,
      input.metaAdId,
      input.metaCreativeId ?? null,
      input.status ?? "PAUSED",
      input.aiScore ?? null,
    ],
  });
}

export interface ReelAdJoinedRow extends ReelAdRow {
  metaAdsetId: string;
  metaCampaignId: string;
}

// Joined query — only rows where the ad has not been retired. Used by monitor
// cron's stop-condition pass (one tenant -> all live ads to evaluate).
export async function getActiveReelAdsForTenant(tenantId: string): Promise<ReelAdJoinedRow[]> {
  const res = await db.execute({
    sql: `SELECT
            ra.*,
            la.meta_adset_id   AS meta_adset_id,
            tc.meta_campaign_id AS meta_campaign_id
          FROM reel_ads ra
          JOIN location_adsets la ON la.id = ra.location_adset_id
          JOIN tenant_campaigns tc ON tc.id = la.tenant_campaign_id
          WHERE tc.tenant_id = ? AND ra.retired_at IS NULL`,
    args: [tenantId],
  });
  return res.rows.map((r) => {
    const row = r as unknown as Record<string, unknown>;
    return {
      ...rowToReelAd(row),
      metaAdsetId: row.meta_adset_id as string,
      metaCampaignId: row.meta_campaign_id as string,
    };
  });
}

export async function recordReelAdRetirement(metaAdId: string, reason: string): Promise<void> {
  await db.execute({
    sql: `UPDATE reel_ads
            SET status         = 'PAUSED',
                retired_at     = CURRENT_TIMESTAMP,
                retired_reason = ?
          WHERE meta_ad_id = ?`,
    args: [reason, metaAdId],
  });
}

// ---------------------------------------------------------------------------
// ai_decisions
// ---------------------------------------------------------------------------

export interface AiDecisionInsert {
  tenantId: string;
  decisionType: "BUDGET_TILT" | "STOP_AD" | "NARRATE";
  inputJson: string;
  outputJson: string;
  llmModel: string;
  inputTokens: number;
  outputTokens: number;
  costPennies: number;
  narrative: string;
  valid: boolean;
}

export async function insertAiDecision(input: AiDecisionInsert): Promise<number> {
  const res = await db.execute({
    sql: `INSERT INTO ai_decisions
      (tenant_id, decision_type, input_json, output_json, llm_model,
       input_tokens, output_tokens, cost_pennies, narrative, valid)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id`,
    args: [
      input.tenantId,
      input.decisionType,
      input.inputJson,
      input.outputJson,
      input.llmModel,
      input.inputTokens,
      input.outputTokens,
      input.costPennies,
      input.narrative,
      input.valid ? 1 : 0,
    ],
  });
  return Number((res.rows[0] as unknown as Record<string, unknown>).id);
}
