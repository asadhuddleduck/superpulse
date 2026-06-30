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
  // Reconcile token-health (added 2026-06-30). A stored Meta token failed its
  // /me health check — the tenant must reconnect Instagram or every Meta write
  // silently fails. Surfaced via Slack + the needs_reauth flag on the tenant.
  | "token_dead"
  // v8 engine event types (added 2026-05-04). One per cron-tick lifecycle event.
  | "v8_scan_tick"
  | "v8_decision_made"
  | "v8_decision_invalid"
  | "v8_intent_executed"
  | "v8_intent_skipped"
  | "v8_circuit_breaker_tripped"
  | "v8_ad_retired"
  // v8 provisioning lane (added 2026-06-02).
  | "v8_provision_started"
  | "v8_provision_adset_created"
  | "v8_provision_ad_created"
  | "v8_provision_activated"
  | "v8_provision_completed"
  | "v8_provision_failed"
  // Built but nothing live — every ad disapproved/retired (e.g. all reels carry
  // copyright music). Distinct from v8_provision_failed (which parks the tenant);
  // here the tenant stays in 'provisioning' so a freshly-posted clean Reel still
  // self-heals, and this event just dedups the operator alert.
  | "v8_no_eligible_content"
  | "v8_batch_error"
  | "insights_pagination_capped"
  | "budget_approved"
  // Self-serve pause/resume (added 29 Jun 2026).
  | "boost_paused"
  | "boost_resumed";

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

/**
 * True if an audit event of `eventType` was written for this tenant within the
 * last `withinHours`. Used to dedup recurring cron alerts (a 5-min cron must not
 * Slack-spam the same condition every tick). created_at is UTC CURRENT_TIMESTAMP,
 * directly comparable with datetime('now').
 */
export async function hasRecentAuditEvent(
  tenantId: string,
  eventType: AuditEventType,
  withinHours: number,
): Promise<boolean> {
  const result = await db.execute({
    sql: `
      SELECT 1 FROM audit_events
      WHERE tenant_id = ? AND event_type = ?
        AND created_at >= datetime('now', ?)
      LIMIT 1
    `,
    args: [tenantId, eventType, `-${withinHours} hours`],
  });
  return result.rows.length > 0;
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
