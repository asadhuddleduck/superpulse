// ---------------------------------------------------------------------------
// v8 Batch-API ad-set provisioning (flag-gated: V8_BATCH_CREATION).
//
// Collapses a 62-location cold provision from ~62 single createAdSet calls to
// ~2 Batch-API requests (BATCH_MAX_OPS = 50/op). PURE op-building + result
// reconciliation live here so they are unit-testable WITHOUT touching Meta; the
// only network call is provisionAdsetsBatch().
//
// SAFETY: this path is OFF by default. When V8_BATCH_CREATION !== "on", the
// execute cron's creation lane is byte-identical to the proven single-call loop.
// Batch ops are NOT atomic — op 30 failing leaves ops 1-29 as real Meta ad sets,
// so the caller persists each succeeded id and re-queues each failure (the
// reconciliation below makes that mapping explicit). Targeting/budget come from
// the shared buildAdSetCreateBody so this can never drift from createAdSet.
// ---------------------------------------------------------------------------

import {
  buildAdSetCreateBody,
  batchWrite,
  type AdSetCreateSpec,
  type BatchOp,
  type BatchResult,
} from "@/lib/facebook";

/** One ad set to provision, tagged with the intent + location it satisfies. */
export interface AdSetProvisionSpec extends AdSetCreateSpec {
  intentId: number;
  locationId: number;
}

/** Per-spec outcome after the batch returns — drives the caller's DB writes. */
export interface AdSetProvisionOutcome {
  intentId: number;
  locationId: number;
  ok: boolean;
  /** The created ad set's Meta id (only when ok). */
  metaAdsetId: string | null;
  /** Failure reason (null when ok) — caller re-queues / marks errored. */
  error: string | null;
}

/**
 * Build the Meta Batch ops (one POST /act_<id>/adsets per spec). The access
 * token is supplied to batchWrite via the Authorization header, so it is NOT
 * embedded per-op. Order is preserved 1:1 with `specs` — reconcile relies on it.
 */
export function buildAdsetBatchOps(specs: AdSetProvisionSpec[], adAccountId: string): BatchOp[] {
  const clean = adAccountId.startsWith("act_") ? adAccountId.slice(4) : adAccountId;
  return specs.map((s) => ({
    method: "POST",
    relativeUrl: `act_${clean}/adsets`,
    body: buildAdSetCreateBody(s),
  }));
}

/**
 * Map batchWrite's per-op results back to per-spec outcomes by index. A result
 * is only `ok` if Meta returned 2xx AND a usable ad set id; a 2xx with no id is
 * treated as a failure so the caller re-queues rather than silently dropping it.
 */
export function reconcileAdsetBatch(
  specs: AdSetProvisionSpec[],
  result: BatchResult,
): AdSetProvisionOutcome[] {
  return specs.map((s, i) => {
    const r = result.results[i];
    if (!r) {
      return { intentId: s.intentId, locationId: s.locationId, ok: false, metaAdsetId: null, error: "missing batch result" };
    }
    const id = r.ok ? ((r.body as { id?: string } | null)?.id ?? null) : null;
    if (r.ok && id) {
      return { intentId: s.intentId, locationId: s.locationId, ok: true, metaAdsetId: id, error: null };
    }
    return {
      intentId: s.intentId,
      locationId: s.locationId,
      ok: false,
      metaAdsetId: null,
      error: r.ok ? "Meta returned 2xx but no ad set id" : (r.error ?? `HTTP ${r.code}`),
    };
  });
}

/**
 * Build ops, call the Batch API, and reconcile — the one network call. Returns
 * an empty array for empty input (no-op). Lets batchWrite's outer throw (auth /
 * malformed whole-batch rejection) propagate so the caller falls back to the
 * single-call lane for that tick.
 */
export async function provisionAdsetsBatch(
  specs: AdSetProvisionSpec[],
  adAccountId: string,
  token: string,
): Promise<AdSetProvisionOutcome[]> {
  if (specs.length === 0) return [];
  const ops = buildAdsetBatchOps(specs, adAccountId);
  const result = await batchWrite(ops, token);
  return reconcileAdsetBatch(specs, result);
}
