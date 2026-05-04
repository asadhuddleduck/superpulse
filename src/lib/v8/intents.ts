import { db } from "@/lib/db";

// Intent queue used by the v8 engine.
// Producer: decide cron (BUDGET_TILT + STOP_AD).
// Consumer: execute cron (drains in batches of 3 per tenant).
// Also produced by monitor cron when stop conditions trigger.
//
// State machine: pending -> done | skipped | errored. Once an intent leaves
// pending it never comes back. Retries happen via fresh decide ticks creating
// fresh intents, not via re-queuing.

export type IntentType = "BUDGET_TILT" | "STOP_AD";
export type IntentStatus = "pending" | "done" | "skipped" | "errored";

export interface BudgetTiltPayload {
  metaAdsetId: string;
  newDailyBudgetPennies: number;
  reason: string;
}

export interface StopAdPayload {
  metaAdId: string;
  reason: string;
}

export interface IntentRow {
  id: number;
  tenantId: string;
  aiDecisionId: number | null;
  intentType: IntentType;
  payload: BudgetTiltPayload | StopAdPayload;
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
  payload: BudgetTiltPayload | StopAdPayload;
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
  const res = await db.execute({
    sql: `SELECT * FROM v8_intents
          WHERE tenant_id = ? AND status = 'pending'
          ORDER BY created_at ASC
          LIMIT ?`,
    args: [tenantId, limit],
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
