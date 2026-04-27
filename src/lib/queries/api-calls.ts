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
