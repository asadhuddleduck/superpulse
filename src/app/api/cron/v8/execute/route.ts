import { NextResponse } from "next/server";
import { updateAdSetDailyBudget, updateNodeStatus } from "@/lib/facebook";
import { checkCronAuth } from "@/lib/cron-auth";
import { getActiveTenants, type Tenant } from "@/lib/queries/tenants";
import {
  getTenantCampaign,
  getLocationAdsets,
  recordAdsetBudgetWrite,
  recordReelAdRetirement,
  type LocationAdsetRow,
} from "@/lib/queries/v8";
import {
  drainPendingIntents,
  markIntentDone,
  markIntentSkipped,
  markIntentErrored,
  type IntentRow,
  type BudgetTiltPayload,
  type StopAdPayload,
} from "@/lib/v8/intents";
import { applyTilts, type TiltDirective } from "@/lib/v8/budget-tilt";
import { logApiCall } from "@/lib/queries/api-calls";
import { writeAuditEvent } from "@/lib/queries/audit-events";

// v8 execute cron — 30-min cadence. Per active tenant: drain up to 3 pending
// intents, re-fetch adsets once per batch, re-validate each tilt against
// fresh state via applyTilts (3× spread + 24h cooldown enforced fresh),
// apply STOP_AD via updateNodeStatus + recordReelAdRetirement.
// Within-batch local cache update so consecutive tilts on different adsets
// see prior writes.

const MAX_INTENTS_PER_TICK = 3;

interface TenantExecuteResult {
  tenantId: string;
  drained: number;
  done: number;
  skipped: number;
  errored: number;
  error?: string;
}

function isBudgetTiltPayload(intent: IntentRow): intent is IntentRow & { payload: BudgetTiltPayload } {
  return intent.intentType === "BUDGET_TILT";
}
function isStopAdPayload(intent: IntentRow): intent is IntentRow & { payload: StopAdPayload } {
  return intent.intentType === "STOP_AD";
}

async function executeOneTenant(tenant: Tenant): Promise<TenantExecuteResult> {
  const result: TenantExecuteResult = {
    tenantId: tenant.id,
    drained: 0,
    done: 0,
    skipped: 0,
    errored: 0,
  };

  const token = tenant.metaAccessToken;
  if (!token) {
    result.error = "missing meta credentials";
    return result;
  }

  const intents = await drainPendingIntents(tenant.id, MAX_INTENTS_PER_TICK);
  if (intents.length === 0) return result;
  result.drained = intents.length;

  // Snapshot adsets once for the batch — local cache below mutates as we go.
  const tenantCampaign = await getTenantCampaign(tenant.id);
  const adsets: LocationAdsetRow[] = tenantCampaign ? await getLocationAdsets(tenantCampaign.id) : [];
  const adsetsByMetaId = new Map<string, LocationAdsetRow>(adsets.map((a) => [a.metaAdsetId, a]));

  for (const intent of intents) {
    try {
      if (isBudgetTiltPayload(intent)) {
        const payload = intent.payload;
        const adset = adsetsByMetaId.get(payload.metaAdsetId);
        if (!adset) {
          await markIntentSkipped(intent.id, `adset gone for ${payload.metaAdsetId}`);
          result.skipped++;
          await writeAuditEvent(tenant.id, "v8_intent_skipped", "BUDGET_TILT skipped", {
            intentId: intent.id,
            payload,
            reason: "adset gone",
          });
          continue;
        }
        const current = adset.dailyBudgetPennies ?? 100;
        if (payload.newDailyBudgetPennies === current) {
          await markIntentSkipped(intent.id, "no-op vs current budget");
          result.skipped++;
          await writeAuditEvent(tenant.id, "v8_intent_skipped", "BUDGET_TILT no-op", {
            intentId: intent.id,
            payload,
            reason: "no-op vs current",
          });
          continue;
        }
        // Re-validate via applyTilts with a single directive against fresh state.
        const directive: TiltDirective = {
          locationId: adset.locationId,
          tilt: payload.newDailyBudgetPennies > current ? "up" : "down",
          reason: payload.reason,
        };
        const { mutations, skipped } = applyTilts(Array.from(adsetsByMetaId.values()), [directive]);
        const mutation = mutations.find((m) => m.metaAdsetId === payload.metaAdsetId);
        if (!mutation) {
          const reason = skipped[0]?.reason ?? "guardrail re-validation produced no mutation";
          await markIntentSkipped(intent.id, reason);
          result.skipped++;
          await writeAuditEvent(tenant.id, "v8_intent_skipped", "BUDGET_TILT guardrail-blocked", {
            intentId: intent.id,
            payload,
            reason,
          });
          continue;
        }

        // Apply Meta mutation.
        const callStart = Date.now();
        try {
          await updateAdSetDailyBudget(payload.metaAdsetId, mutation.newDailyBudgetPennies, token);
          await logApiCall({
            tenantId: tenant.id,
            endpoint: `/${payload.metaAdsetId}`,
            method: "POST",
            statusCode: 200,
            durationMs: Date.now() - callStart,
          });
        } catch (err) {
          await logApiCall({
            tenantId: tenant.id,
            endpoint: `/${payload.metaAdsetId}`,
            method: "POST",
            statusCode: 500,
            durationMs: Date.now() - callStart,
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }

        // Persist + update local cache so subsequent intents see new budget.
        await recordAdsetBudgetWrite(payload.metaAdsetId, mutation.newDailyBudgetPennies);
        adsetsByMetaId.set(payload.metaAdsetId, {
          ...adset,
          dailyBudgetPennies: mutation.newDailyBudgetPennies,
          lastGuardrailWriteAt: new Date().toISOString(),
        });
        await markIntentDone(intent.id);
        result.done++;
        await writeAuditEvent(tenant.id, "v8_intent_executed", "BUDGET_TILT applied", {
          intentId: intent.id,
          metaAdsetId: payload.metaAdsetId,
          oldPennies: current,
          newPennies: mutation.newDailyBudgetPennies,
          reason: mutation.reason,
        });
      } else if (isStopAdPayload(intent)) {
        const payload = intent.payload;
        const callStart = Date.now();
        try {
          await updateNodeStatus(payload.metaAdId, "PAUSED", token);
          await logApiCall({
            tenantId: tenant.id,
            endpoint: `/${payload.metaAdId}`,
            method: "POST",
            statusCode: 200,
            durationMs: Date.now() - callStart,
          });
        } catch (err) {
          await logApiCall({
            tenantId: tenant.id,
            endpoint: `/${payload.metaAdId}`,
            method: "POST",
            statusCode: 500,
            durationMs: Date.now() - callStart,
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
        await recordReelAdRetirement(payload.metaAdId, payload.reason);
        await markIntentDone(intent.id);
        result.done++;
        await writeAuditEvent(tenant.id, "v8_ad_retired", `Ad retired: ${payload.reason}`, {
          intentId: intent.id,
          payload,
        });
      } else {
        await markIntentSkipped(intent.id, `unknown intent_type ${intent.intentType}`);
        result.skipped++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await markIntentErrored(intent.id, msg);
      result.errored++;
      await writeAuditEvent(tenant.id, "v8_intent_skipped", "intent errored", {
        intentId: intent.id,
        error: msg.slice(0, 200),
      });
    }
  }

  return result;
}

const TENANT_CONCURRENCY = 5;

async function runExecute() {
  const tenants = await getActiveTenants();
  const results: TenantExecuteResult[] = new Array(tenants.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= tenants.length) return;
      try {
        results[i] = await executeOneTenant(tenants[i]);
      } catch (err) {
        results[i] = {
          tenantId: tenants[i].id,
          drained: 0,
          done: 0,
          skipped: 0,
          errored: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }
  const workers = Array.from({ length: Math.min(TENANT_CONCURRENCY, tenants.length) }, () => worker());
  await Promise.all(workers);
  return {
    tenantsProcessed: tenants.length,
    intentsDone: results.reduce((s, r) => s + r.done, 0),
    intentsSkipped: results.reduce((s, r) => s + r.skipped, 0),
    intentsErrored: results.reduce((s, r) => s + r.errored, 0),
    results,
  };
}

export async function GET(request: Request) {
  if (process.env.V8_ENGINE_ENABLED !== "on") {
    return NextResponse.json({ ok: false, skipped: true, reason: "v8 engine gated" });
  }
  const authError = checkCronAuth(request);
  if (authError) return authError;
  try {
    const summary = await runExecute();
    return NextResponse.json(summary);
  } catch (err) {
    console.error("v8 execute cron error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const POST = GET;
