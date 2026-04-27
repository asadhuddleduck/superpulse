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

/** All tenants whose status === 'active' (i.e. ready for cron processing). */
export async function getActiveTenants(): Promise<Tenant[]> {
  const result = await db.execute({
    sql: `SELECT * FROM tenants WHERE status = 'active' AND meta_access_token IS NOT NULL`,
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
