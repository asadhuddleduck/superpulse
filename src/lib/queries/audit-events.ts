import { db } from "@/lib/db";

export type AuditEventType =
  | "scan_completed"
  | "boost_created"
  | "boost_activated"
  | "boost_succeeded"
  | "boost_failed"
  | "cleanup_deleted"
  | "cleanup_failed"
  | "review_failed"
  | "spend_threshold"
  | "error"
  | "onboarding_complete"
  | "subscription_changed"
  // v8 engine event types (added 2026-05-04). One per cron-tick lifecycle event.
  | "v8_scan_tick"
  | "v8_decision_made"
  | "v8_decision_invalid"
  | "v8_intent_executed"
  | "v8_intent_skipped"
  | "v8_circuit_breaker_tripped"
  | "v8_ad_retired";

export interface AuditEventRow {
  id: number;
  tenantId: string;
  eventType: AuditEventType;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export async function writeAuditEvent(
  tenantId: string,
  eventType: AuditEventType,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.execute({
      sql: `
        INSERT INTO audit_events (tenant_id, event_type, message, metadata)
        VALUES (?, ?, ?, ?)
      `,
      args: [
        tenantId,
        eventType,
        message,
        metadata ? JSON.stringify(metadata) : null,
      ],
    });
  } catch {
    // Audit logging must never break the caller.
  }
}

export async function getRecentEvents(
  tenantId: string,
  limit = 10,
): Promise<AuditEventRow[]> {
  const result = await db.execute({
    sql: `
      SELECT id, tenant_id, event_type, message, metadata, created_at
      FROM audit_events
      WHERE tenant_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
    args: [tenantId, limit],
  });

  return result.rows.map((row) => ({
    id: Number(row.id),
    tenantId: String(row.tenant_id),
    eventType: row.event_type as AuditEventType,
    message: String(row.message),
    metadata: row.metadata ? JSON.parse(String(row.metadata)) : null,
    createdAt: String(row.created_at),
  }));
}
