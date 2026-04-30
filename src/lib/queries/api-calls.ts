import { db } from "@/lib/db";

export interface ApiCallEntry {
  tenantId: string | null;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  error?: string | null;
}

export async function logApiCall(entry: ApiCallEntry): Promise<void> {
  try {
    await db.execute({
      sql: `
        INSERT INTO api_call_log
          (tenant_id, endpoint, method, status_code, duration_ms, error)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [
        entry.tenantId,
        entry.endpoint,
        entry.method,
        entry.statusCode,
        entry.durationMs,
        entry.error ?? null,
      ],
    });
  } catch {
    // Logging must never break the caller; swallow.
  }
}

export interface CallVolumeStats {
  total: number;
  errors: number;
  successRate: number;
}

/**
 * Count Marketing API calls in the last N days. Used to track progress toward
 * Meta's 1500-calls-in-15-days threshold for Ads Management Standard Access.
 */
export async function getCallVolumeSinceDays(days: number): Promise<CallVolumeStats> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const result = await db.execute({
    sql: `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status_code >= 400 OR error IS NOT NULL THEN 1 ELSE 0 END) AS errors
      FROM api_call_log
      WHERE created_at >= ?
    `,
    args: [since],
  });
  const row = result.rows[0] ?? { total: 0, errors: 0 };
  const total = Number(row.total ?? 0);
  const errors = Number(row.errors ?? 0);
  return {
    total,
    errors,
    successRate: total === 0 ? 1 : (total - errors) / total,
  };
}

/**
 * Most recent successful (status<400) api_call_log row whose endpoint matches
 * the given LIKE pattern, scoped to a tenant. Used by StatusPanel to surface
 * "last scan: X min ago" — pass `%/media%` to match IG media fetches.
 */
export async function getLastSuccessfulCallByEndpoint(
  tenantId: string,
  endpointPattern: string,
): Promise<string | null> {
  const result = await db.execute({
    sql: `
      SELECT created_at
      FROM api_call_log
      WHERE tenant_id = ?
        AND endpoint LIKE ?
        AND (status_code IS NULL OR status_code < 400)
      ORDER BY created_at DESC
      LIMIT 1
    `,
    args: [tenantId, endpointPattern],
  });
  if (result.rows.length === 0) return null;
  return String(result.rows[0].created_at);
}

/**
 * Most recent error row (status>=400 or error not null) for a tenant in the
 * last 24 hours. Drives the StatusPanel "lastError" surface.
 */
export async function getRecentErrorForTenant(
  tenantId: string,
): Promise<{ endpoint: string; error: string; at: string } | null> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const result = await db.execute({
    sql: `
      SELECT endpoint, error, status_code, created_at
      FROM api_call_log
      WHERE tenant_id = ?
        AND created_at >= ?
        AND (status_code >= 400 OR error IS NOT NULL)
      ORDER BY created_at DESC
      LIMIT 1
    `,
    args: [tenantId, since],
  });
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    endpoint: String(row.endpoint),
    error: row.error ? String(row.error) : `HTTP ${row.status_code}`,
    at: String(row.created_at),
  };
}
