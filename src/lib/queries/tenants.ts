import { db } from "@/lib/db";
import { decryptIfNeeded, ensureEncrypted } from "@/lib/crypto";

export interface Tenant {
  id: string;
  igUserId: string | null;
  adAccountId: string | null;
  name: string | null;
  metaAccessToken: string | null;
  metaPixelId: string | null;
  pageId: string | null;
  igUsername: string | null;
  status: string;
  tokenExpiresAt: string | null;
  // Phase 4 — Stripe billing
  subscriptionStatus: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  email: string | null;
  legacy: boolean;
  // v8 provisioning + budget intake (added 2026-06-02). NULL on every existing
  // tenant — a separate axis from `status` so the live dashboard gate is untouched.
  provisioningStatus: string | null;
  monthlyAdBudgetPennies: number | null;
  budgetApprovedAt: string | null;
  // Agency HQ (added 25 Jun 2026)
  comp: boolean;
  hqPaused: boolean;
  signupLinkId: number | null;
  offboardedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToTenant(row: Record<string, unknown>): Tenant {
  return {
    id: row.id as string,
    igUserId: (row.ig_user_id as string | null) ?? null,
    adAccountId: (row.ad_account_id as string | null) ?? null,
    name: (row.name as string | null) ?? null,
    metaAccessToken: decryptIfNeeded(row.meta_access_token as string | null),
    metaPixelId: (row.meta_pixel_id as string | null) ?? null,
    pageId: (row.page_id as string | null) ?? null,
    igUsername: (row.ig_username as string | null) ?? null,
    status: ((row.status as string | null) ?? "pending_oauth") as string,
    tokenExpiresAt: (row.token_expires_at as string | null) ?? null,
    subscriptionStatus: ((row.subscription_status as string | null) ?? "pending") as string,
    stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
    stripeSubscriptionId: (row.stripe_subscription_id as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    legacy: Number(row.legacy ?? 0) === 1,
    provisioningStatus: (row.provisioning_status as string | null) ?? null,
    monthlyAdBudgetPennies: row.monthly_ad_budget_pennies == null ? null : Number(row.monthly_ad_budget_pennies),
    budgetApprovedAt: (row.budget_approved_at as string | null) ?? null,
    comp: Number(row.comp ?? 0) === 1,
    hqPaused: Number(row.hq_paused ?? 0) === 1,
    signupLinkId: row.signup_link_id == null ? null : Number(row.signup_link_id),
    offboardedAt: (row.offboarded_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? (row.created_at as string),
  };
}

export interface TenantUpsert {
  id: string;
  igUserId?: string | null;
  adAccountId?: string | null;
  name?: string | null;
  metaAccessToken?: string | null;
  metaPixelId?: string | null;
  pageId?: string | null;
  igUsername?: string | null;
  status?: string;
  tokenExpiresAt?: string | null;
}

/**
 * Insert or update a tenant. Only fields provided are written; existing values
 * are preserved (uses COALESCE to merge).
 */
export async function upsertTenant(t: TenantUpsert): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `
      INSERT INTO tenants (
        id, ig_user_id, ad_account_id, name,
        meta_access_token, meta_pixel_id, page_id, ig_username,
        status, token_expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        ig_user_id        = COALESCE(excluded.ig_user_id,        tenants.ig_user_id),
        ad_account_id     = COALESCE(excluded.ad_account_id,     tenants.ad_account_id),
        name              = COALESCE(excluded.name,              tenants.name),
        meta_access_token = COALESCE(excluded.meta_access_token, tenants.meta_access_token),
        meta_pixel_id     = COALESCE(excluded.meta_pixel_id,     tenants.meta_pixel_id),
        page_id           = COALESCE(excluded.page_id,           tenants.page_id),
        ig_username       = COALESCE(excluded.ig_username,       tenants.ig_username),
        status            = COALESCE(excluded.status,            tenants.status),
        token_expires_at  = COALESCE(excluded.token_expires_at,  tenants.token_expires_at),
        updated_at        = excluded.updated_at
    `,
    args: [
      t.id,
      t.igUserId ?? null,
      t.adAccountId ?? null,
      t.name ?? null,
      ensureEncrypted(t.metaAccessToken),
      t.metaPixelId ?? null,
      t.pageId ?? null,
      t.igUsername ?? null,
      t.status ?? null,
      t.tokenExpiresAt ?? null,
      now,
      now,
    ],
  });
}

/**
 * Tenants ready for cron processing: status === 'active', token present, NOT
 * operator-paused, and either subscription active/trialing OR flagged legacy
 * (grandfathered) OR flagged comp (prepaid/comped via an HQ join link).
 */
export async function getActiveTenants(): Promise<Tenant[]> {
  const result = await db.execute({
    sql: `
      SELECT * FROM tenants
      WHERE status = 'active'
        AND meta_access_token IS NOT NULL
        AND COALESCE(hq_paused, 0) = 0
        AND (
          legacy = 1
          OR comp = 1
          OR subscription_status IN ('active', 'trialing')
        )
    `,
    args: [],
  });
  return result.rows.map(rowToTenant);
}

// ---------------------------------------------------------------------------
// v8 provisioning + budget intake (added 2026-06-02)
// ---------------------------------------------------------------------------

/** Set the budget-intake / provisioning axis. Does NOT touch tenants.status. */
export async function setProvisioningStatus(
  id: string,
  status: "pending_locations" | "pending_budget" | "provisioning" | "provisioned" | "provision_failed",
): Promise<void> {
  await db.execute({
    sql: `UPDATE tenants SET provisioning_status = ?, updated_at = ? WHERE id = ?`,
    args: [status, new Date().toISOString(), id],
  });
}

/**
 * Record the client-approved monthly ad budget and flip the tenant into
 * provisioning. Caller MUST have run validateTenantBudget first.
 */
export async function setTenantBudget(id: string, monthlyAdBudgetPennies: number): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE tenants
            SET monthly_ad_budget_pennies = ?,
                budget_approved_at        = ?,
                provisioning_status       = 'provisioning',
                updated_at                = ?
          WHERE id = ?`,
    args: [monthlyAdBudgetPennies, now, now, id],
  });
}

/**
 * Tenants the provision cron processes: active, budget approved, NOT legacy
 * (legacy clients never migrate to v8 — V8-SPEC §25), token present.
 *
 * Includes BOTH 'provisioning' (initial build in flight) AND 'provisioned'
 * (initial build done) — the latter so newly-posted Reels keep getting ads on
 * the ongoing diff. 'provision_failed' is excluded until the client re-approves
 * a viable budget (which flips them back to 'provisioning').
 */
export async function getTenantsAwaitingProvision(): Promise<Tenant[]> {
  const result = await db.execute({
    sql: `
      SELECT * FROM tenants
      WHERE status = 'active'
        AND provisioning_status IN ('provisioning', 'provisioned')
        AND COALESCE(legacy, 0) = 0
        AND meta_access_token IS NOT NULL
    `,
    args: [],
  });
  return result.rows.map(rowToTenant);
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const result = await db.execute({
    sql: `SELECT * FROM tenants WHERE id = ? LIMIT 1`,
    args: [id],
  });
  return result.rows.length ? rowToTenant(result.rows[0]) : null;
}

export async function getTenantByIgUserId(igUserId: string): Promise<Tenant | null> {
  const result = await db.execute({
    sql: `SELECT * FROM tenants WHERE ig_user_id = ? LIMIT 1`,
    args: [igUserId],
  });
  return result.rows.length ? rowToTenant(result.rows[0]) : null;
}

export async function updateTenantToken(
  id: string,
  token: string,
  expiresInSeconds: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  await db.execute({
    sql: `
      UPDATE tenants
      SET meta_access_token = ?,
          token_expires_at  = ?,
          status            = 'active',
          updated_at        = ?
      WHERE id = ?
    `,
    args: [ensureEncrypted(token), expiresAt, new Date().toISOString(), id],
  });
}

export async function updateTenantStatus(id: string, status: string): Promise<void> {
  await db.execute({
    sql: `UPDATE tenants SET status = ?, updated_at = ? WHERE id = ?`,
    args: [status, new Date().toISOString(), id],
  });
}

/** Stripe webhook lookup: find a tenant by their Stripe customer ID. */
export async function getTenantByStripeCustomerId(
  stripeCustomerId: string,
): Promise<Tenant | null> {
  const result = await db.execute({
    sql: `SELECT * FROM tenants WHERE stripe_customer_id = ? LIMIT 1`,
    args: [stripeCustomerId],
  });
  return result.rows.length ? rowToTenant(result.rows[0]) : null;
}

/** Stripe webhook lookup: find a tenant by email (used pre-OAuth before tenant_id is known). */
export async function getTenantByEmail(email: string): Promise<Tenant | null> {
  const result = await db.execute({
    sql: `SELECT * FROM tenants WHERE email = ? LIMIT 1`,
    args: [email],
  });
  return result.rows.length ? rowToTenant(result.rows[0]) : null;
}

/**
 * Set or update Stripe-related fields on a tenant. All args optional — the
 * tenant row must already exist (created by Stripe webhook on
 * checkout.session.completed).
 */
export async function setTenantStripeFields(
  id: string,
  fields: {
    subscriptionStatus?: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    email?: string | null;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `
      UPDATE tenants
      SET subscription_status     = COALESCE(?, subscription_status),
          stripe_customer_id      = COALESCE(?, stripe_customer_id),
          stripe_subscription_id  = COALESCE(?, stripe_subscription_id),
          email                   = COALESCE(?, email),
          updated_at              = ?
      WHERE id = ?
    `,
    args: [
      fields.subscriptionStatus ?? null,
      fields.stripeCustomerId ?? null,
      fields.stripeSubscriptionId ?? null,
      fields.email ?? null,
      now,
      id,
    ],
  });
}

// ---------------------------------------------------------------------------
// Agency HQ lifecycle mutators (added 25 Jun 2026)
// ---------------------------------------------------------------------------

/** Operator Pause / Reactivate — stops cron processing; subscription untouched. */
export async function setTenantPaused(id: string, paused: boolean): Promise<void> {
  await db.execute({
    sql: `UPDATE tenants SET hq_paused = ?, updated_at = ? WHERE id = ?`,
    args: [paused ? 1 : 0, new Date().toISOString(), id],
  });
}

/** Flip the comp (prepaid) flag — comped clients bypass the Stripe billing gate. */
export async function setTenantComp(id: string, comp: boolean): Promise<void> {
  await db.execute({
    sql: `UPDATE tenants SET comp = ?, updated_at = ? WHERE id = ?`,
    args: [comp ? 1 : 0, new Date().toISOString(), id],
  });
}

/**
 * Kick / offboard: revoke access. Sets status='offboarded' + subscription
 * 'canceled' + clears comp + records offboarded_at. Campaign pausing and Stripe
 * cancellation are orchestrated by the caller (HQ lifecycle route) — this only
 * flips the DB state that gates the dashboard + crons. Never deletes anything.
 */
export async function offboardTenant(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE tenants
            SET status = 'offboarded',
                subscription_status = 'canceled',
                comp = 0,
                hq_paused = 1,
                offboarded_at = ?,
                updated_at = ?
          WHERE id = ?`,
    args: [now, now, id],
  });
}

/**
 * Reverse an offboard: restore to active + clear paused/offboarded markers.
 * Only acts on a genuinely offboarded tenant (WHERE status = 'offboarded'), so
 * it can't jam an in-flight onboarding tenant to 'active'. Returns true iff it
 * actually reinstated. Does NOT restore comp — offboard cleared it, so a
 * previously-comped client must be re-comped explicitly (the dashboard re-gates
 * on subscription/comp, so without it they correctly land on /pricing).
 */
export async function reinstateTenant(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const res = await db.execute({
    sql: `UPDATE tenants
            SET status = 'active',
                hq_paused = 0,
                offboarded_at = NULL,
                updated_at = ?
          WHERE id = ? AND status = 'offboarded'`,
    args: [now, id],
  });
  return res.rowsAffected === 1;
}

/**
 * Mark a tenant comped (prepaid HQ join). Bypasses the Stripe billing gate like
 * `legacy` but is flagged distinctly. Idempotent; attaches the join link too.
 */
export async function setTenantCompFromJoin(id: string, signupLinkId: number | null): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE tenants
            SET comp = 1,
                signup_link_id = COALESCE(?, signup_link_id),
                updated_at = ?
          WHERE id = ?`,
    args: [signupLinkId, now, id],
  });
}

/** Tag a tenant with the join link it came through (attribution). */
export async function attachSignupLink(id: string, signupLinkId: number): Promise<void> {
  await db.execute({
    sql: `UPDATE tenants SET signup_link_id = ?, updated_at = ? WHERE id = ?`,
    args: [signupLinkId, new Date().toISOString(), id],
  });
}

/** Insert a tenant with only Stripe info — used pre-OAuth from the webhook. */
export async function createPendingTenant(
  id: string,
  fields: {
    email: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string | null;
    subscriptionStatus: string;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `
      INSERT INTO tenants (
        id, email, stripe_customer_id, stripe_subscription_id,
        subscription_status, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'pending_oauth', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email                   = excluded.email,
        stripe_customer_id      = excluded.stripe_customer_id,
        stripe_subscription_id  = excluded.stripe_subscription_id,
        subscription_status     = excluded.subscription_status,
        updated_at              = excluded.updated_at
    `,
    args: [
      id,
      fields.email,
      fields.stripeCustomerId,
      fields.stripeSubscriptionId,
      fields.subscriptionStatus,
      now,
      now,
    ],
  });
}
