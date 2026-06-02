import { getLatestAppUsage } from "@/lib/queries/rate-limits";
import { writeAuditEvent } from "@/lib/queries/audit-events";

// Shared per-app rate-limit circuit breaker for the v8 engine. Extracted from
// the decide cron (the inline copy at decide/route.ts) so decide, execute, and
// the provision/creation lane all gate on the same logic.
//
// Meta's x-app-usage is app-wide (call_count / total_cputime / total_time, all
// 0–100). The breaker reads the freshest captured sample (<=1h old) and trips
// when the peak of the three exceeds the threshold. The 2h "halt" from V8-SPEC
// item 21 falls out naturally: ticks keep re-reading the sample, which stays
// above threshold until Meta's usage decays.

export const CIRCUIT_BREAKER_THRESHOLD = 50; // steady-state lane (decide/execute)
export const CREATION_BREAKER_THRESHOLD = 35; // creation lane — more conservative (burst writer)
export const APP_USAGE_FRESH_MS = 60 * 60 * 1000; // 1h lookback

export interface BreakerVerdict {
  tripped: boolean;
  /** max(callCount, cpuTime, totalTime) from the freshest sample; 0 when none. */
  peak: number;
  reason: string | null;
}

/**
 * Per-app breaker. Returns tripped=true when the freshest rate_limit_log sample
 * is fresh (<=1h) and its peak exceeds the threshold. No fresh sample = not
 * tripped (we have no signal to act on).
 */
export async function checkAppBreaker(threshold: number = CIRCUIT_BREAKER_THRESHOLD): Promise<BreakerVerdict> {
  const usage = await getLatestAppUsage();
  if (!usage) return { tripped: false, peak: 0, reason: null };
  const ageMs = Date.now() - Date.parse(usage.capturedAt);
  if (ageMs > APP_USAGE_FRESH_MS) return { tripped: false, peak: 0, reason: null };
  const peak = Math.max(usage.callCount, usage.cpuTime, usage.totalTime);
  if (peak > threshold) {
    return { tripped: true, peak, reason: `circuit_breaker:${peak}%` };
  }
  return { tripped: false, peak, reason: null };
}

/**
 * Per-tenant convenience: runs checkAppBreaker and, when tripped, writes the
 * shared v8_circuit_breaker_tripped audit event (so decide/execute/provision
 * all log halts identically). Returns the verdict for the caller to skip on.
 */
export async function guardTenant(
  tenantId: string,
  threshold: number,
  lane: "decide" | "execute" | "provision",
): Promise<BreakerVerdict> {
  const verdict = await checkAppBreaker(threshold);
  if (verdict.tripped) {
    await writeAuditEvent(
      tenantId,
      "v8_circuit_breaker_tripped",
      `v8 ${lane}: skipped — X-App-Usage ${verdict.peak}% in last hour (threshold ${threshold}%)`,
      { lane, peak: verdict.peak, threshold },
    );
  }
  return verdict;
}
