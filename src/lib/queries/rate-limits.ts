import { db } from "@/lib/db";

/**
 * Persists Meta's rate-limit headers when present.
 *
 * Meta returns two headers we care about:
 *   - `x-app-usage`               app-level (call count + cpu + total time, all 0–100)
 *   - `x-business-use-case-usage` per-business-account, keyed by business_id
 *
 * Both are JSON-encoded strings. We store the raw JSON so the schema doesn't
 * need to track Meta's evolving structure — query with json_extract() at read time.
 *
 * Rows are skipped when both headers are absent (Meta omits them on cached
 * responses and on a few read-only endpoints). This keeps the table small.
 */
export interface RateLimitEntry {
  adAccountId: string | null;
  endpoint: string;
  appUsage: string | null;
  bucUsage: string | null;
}

export async function logRateLimits(entry: RateLimitEntry): Promise<void> {
  if (!entry.appUsage && !entry.bucUsage) return;
  try {
    await db.execute({
      sql: `
        INSERT INTO rate_limit_log
          (ad_account_id, endpoint, app_usage_json, buc_usage_json)
        VALUES (?, ?, ?, ?)
      `,
      args: [
        entry.adAccountId,
        entry.endpoint,
        entry.appUsage,
        entry.bucUsage,
      ],
    });
  } catch {
    // Telemetry must never break the caller.
  }
}

/**
 * Pulls the latest captured app-utilisation percentages. `call_count`,
 * `total_cputime`, and `total_time` are all 0–100 and the highest of the three
 * is what Meta enforces against. Returns null when the table is empty.
 */
export async function getLatestAppUsage(): Promise<{
  callCount: number;
  cpuTime: number;
  totalTime: number;
  capturedAt: string;
} | null> {
  const result = await db.execute({
    sql: `
      SELECT app_usage_json, captured_at
      FROM rate_limit_log
      WHERE app_usage_json IS NOT NULL
      ORDER BY captured_at DESC
      LIMIT 1
    `,
  });
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  try {
    const usage = JSON.parse(String(row.app_usage_json));
    return {
      callCount: Number(usage.call_count ?? 0),
      cpuTime: Number(usage.total_cputime ?? 0),
      totalTime: Number(usage.total_time ?? 0),
      capturedAt: String(row.captured_at),
    };
  } catch {
    return null;
  }
}

/**
 * Latest per-business-use-case usage peak for a specific ad account. Lets a
 * single throttled ad account trip its own tenant without halting the whole app
 * (the x-app-usage breaker is app-wide). buc_usage_json is keyed by business_id;
 * each entry carries call_count / total_cputime / total_time (all 0–100) plus
 * estimated_time_to_regain_access (minutes). Returns the peak across all
 * entries, or null when no fresh per-account sample exists.
 */
export async function getLatestBucUsageForAccount(adAccountId: string): Promise<{
  peak: number;
  estimatedTimeToRegainAccessMin: number;
  capturedAt: string;
} | null> {
  const result = await db.execute({
    sql: `
      SELECT buc_usage_json, captured_at
      FROM rate_limit_log
      WHERE ad_account_id = ? AND buc_usage_json IS NOT NULL
      ORDER BY captured_at DESC
      LIMIT 1
    `,
    args: [adAccountId],
  });
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  try {
    const buc = JSON.parse(String(row.buc_usage_json)) as Record<
      string,
      Array<{ call_count?: number; total_cputime?: number; total_time?: number; estimated_time_to_regain_access?: number }>
    >;
    let peak = 0;
    let regain = 0;
    for (const entries of Object.values(buc)) {
      for (const e of entries ?? []) {
        peak = Math.max(peak, Number(e.call_count ?? 0), Number(e.total_cputime ?? 0), Number(e.total_time ?? 0));
        regain = Math.max(regain, Number(e.estimated_time_to_regain_access ?? 0));
      }
    }
    return { peak, estimatedTimeToRegainAccessMin: regain, capturedAt: String(row.captured_at) };
  } catch {
    return null;
  }
}
