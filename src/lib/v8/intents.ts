import { db } from "@/lib/db";

// Intent queue used by the v8 engine.
// Producer: decide cron (BUDGET_TILT + STOP_AD).
// Consumer: execute cron (drains in batches of 3 per tenant).
// Also produced by monitor cron when stop conditions trigger.
//
// State machine: pending -> done | skipped | errored. Once an intent leaves
// pending it never comes back. Retries happen via fresh decide ticks creating
// fresh intents, not via re-queuing.

export type IntentType =
  | "BUDGET_TILT"
  | "STOP_AD"
  // Creation lane (added 2026-06-02).
  | "PROVISION_ADSET"
  | "CREATE_AD"
  | "ACTIVATE_AD";
export type IntentStatus = "pending" | "done" | "skipped" | "errored";

// Steady-state lane payloads.
export interface BudgetTiltPayload {
  metaAdsetId: string;
  newDailyBudgetPennies: number;
  reason: string;
}

export interface StopAdPayload {
  metaAdId: string;
  reason: string;
}

// Creation lane payloads (added 2026-06-02).
export interface ProvisionAdsetPayload {
  locationId: number;
  reason: string;
}

export interface CreateAdPayload {
  locationAdsetId: number;
  metaAdsetId: string;
  postId: string;
  reason: string;
}

export interface ActivateAdPayload {
  metaAdId: string;
  locationAdsetId: number;
  reason: string;
}

export type IntentPayload =
  | BudgetTiltPayload
  | StopAdPayload
  | ProvisionAdsetPayload
  | CreateAdPayload
  | ActivateAdPayload;

// The two drain lanes. Kept separate so a creation burst can't starve the
// steady-state budget/stop lane (and vice-versa).
export const STEADY_STATE_INTENT_TYPES: IntentType[] = ["BUDGET_TILT", "STOP_AD"];
export const CREATION_INTENT_TYPES: IntentType[] = ["PROVISION_ADSET", "CREATE_AD", "ACTIVATE_AD"];

export interface IntentRow {
  id: number;
  tenantId: string;
  aiDecisionId: number | null;
  intentType: IntentType;
  payload: IntentPayload;
  status: IntentStatus;
  error: string | null;
  createdAt: string;
  executedAt: string | null;
}

function rowToIntent(row: Record<string, unknown>): IntentRow {
  return {
    id: Number(row.id),
    tenantId: row.tenant_id as string,
    aiDecisionId: row.ai_decision_id == null ? null : Number(row.ai_decision_id),
    intentType: row.intent_type as IntentType,
    payload: JSON.parse(row.payload_json as string),
    status: row.status as IntentStatus,
    error: (row.error as string | null) ?? null,
    createdAt: row.created_at as string,
    executedAt: (row.executed_at as string | null) ?? null,
  };
}

export async function enqueueIntent(input: {
  tenantId: string;
  aiDecisionId: number | null;
  intentType: IntentType;
  payload: IntentPayload;
}): Promise<number> {
  const res = await db.execute({
    sql: `INSERT INTO v8_intents
      (tenant_id, ai_decision_id, intent_type, payload_json)
      VALUES (?, ?, ?, ?)
      RETURNING id`,
    args: [
      input.tenantId,
      input.aiDecisionId,
      input.intentType,
      JSON.stringify(input.payload),
    ],
  });
  return Number((res.rows[0] as unknown as Record<string, unknown>).id);
}

// drainPendingIntents is intentionally read-only. Vercel cron runs one
// instance per fire so two execute ticks won't race for the same tenant's
// queue. If you ever move execute off Vercel cron, swap to a SELECT-then-
// UPDATE-status='in_flight' two-step.
export async function drainPendingIntents(tenantId: string, limit: number = 3): Promise<IntentRow[]> {
  const placeholders = STEADY_STATE_INTENT_TYPES.map(() => "?").join(", ");
  const res = await db.execute({
    sql: `SELECT * FROM v8_intents
          WHERE tenant_id = ? AND status = 'pending' AND intent_type IN (${placeholders})
          ORDER BY created_at ASC
          LIMIT ?`,
    args: [tenantId, ...STEADY_STATE_INTENT_TYPES, limit],
  });
  return res.rows.map((r) => rowToIntent(r as unknown as Record<string, unknown>));
}

// Creation lane drain — same contract as drainPendingIntents but scoped to the
// PROVISION_ADSET/CREATE_AD/ACTIVATE_AD types via idx_v8_intents_type_pending.
// Kept as a separate query so a 62-adset provisioning burst can't starve the
// BUDGET_TILT/STOP_AD lane (and vice-versa). Higher default limit.
export async function drainPendingCreationIntents(tenantId: string, limit: number = 8): Promise<IntentRow[]> {
  const placeholders = CREATION_INTENT_TYPES.map(() => "?").join(", ");
  const res = await db.execute({
    sql: `SELECT * FROM v8_intents
          WHERE tenant_id = ? AND status = 'pending' AND intent_type IN (${placeholders})
          ORDER BY created_at ASC
          LIMIT ?`,
    args: [tenantId, ...CREATION_INTENT_TYPES, limit],
  });
  return res.rows.map((r) => rowToIntent(r as unknown as Record<string, unknown>));
}

// All pending creation-lane intents for a tenant (no limit). The provision cron
// reads these once per tick and dedupes its enqueue diff against them in memory,
// so it never queues a second pending intent for an already-queued target.
export async function getPendingCreationIntents(tenantId: string): Promise<IntentRow[]> {
  const placeholders = CREATION_INTENT_TYPES.map(() => "?").join(", ");
  const res = await db.execute({
    sql: `SELECT * FROM v8_intents
          WHERE tenant_id = ? AND status = 'pending' AND intent_type IN (${placeholders})`,
    args: [tenantId, ...CREATION_INTENT_TYPES],
  });
  return res.rows.map((r) => rowToIntent(r as unknown as Record<string, unknown>));
}

export async function markIntentDone(id: number): Promise<void> {
  await db.execute({
    sql: `UPDATE v8_intents SET status = 'done', executed_at = CURRENT_TIMESTAMP WHERE id = ?`,
    args: [id],
  });
}

export async function markIntentSkipped(id: number, reason: string): Promise<void> {
  await db.execute({
    sql: `UPDATE v8_intents
            SET status = 'skipped', error = ?, executed_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
    args: [reason, id],
  });
}

export async function markIntentErrored(id: number, error: string): Promise<void> {
  await db.execute({
    sql: `UPDATE v8_intents
            SET status = 'errored', error = ?, executed_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
    args: [error, id],
  });
}
