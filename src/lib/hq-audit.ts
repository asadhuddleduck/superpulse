import { db } from "@/lib/db";

// Accountability trail for the Agency HQ. Every operator action that touches a
// client (impersonate, invite, pause, offboard, link-create) writes one row.
// Best-effort: a logging failure must never block the action itself.

export type HqAction =
  | "login"
  | "logout"
  | "invite_member"
  | "disable_member"
  | "enable_member"
  | "change_role"
  | "create_link"
  | "revoke_link"
  | "impersonate_start"
  | "impersonate_stop"
  | "pause_client"
  | "reactivate_client"
  | "offboard_client"
  | "reinstate_client"
  | "comp_client";

export async function logHqAction(
  hqUserId: string | null,
  action: HqAction,
  opts: { targetTenantId?: string | null; metadata?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    await db.execute({
      sql: `INSERT INTO hq_audit_log (hq_user_id, action, target_tenant_id, metadata)
            VALUES (?, ?, ?, ?)`,
      args: [
        hqUserId,
        action,
        opts.targetTenantId ?? null,
        opts.metadata ? JSON.stringify(opts.metadata) : null,
      ],
    });
  } catch (err) {
    console.error("[hq-audit] failed to log", action, err);
  }
}

export interface HqAuditRow {
  id: number;
  hqUserId: string | null;
  action: string;
  targetTenantId: string | null;
  metadata: string | null;
  createdAt: string;
}

export async function getRecentHqActions(limit = 50): Promise<HqAuditRow[]> {
  const result = await db.execute({
    sql: `SELECT * FROM hq_audit_log ORDER BY created_at DESC LIMIT ?`,
    args: [limit],
  });
  return result.rows.map((row) => ({
    id: Number(row.id),
    hqUserId: (row.hq_user_id as string | null) ?? null,
    action: row.action as string,
    targetTenantId: (row.target_tenant_id as string | null) ?? null,
    metadata: (row.metadata as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}

export async function getTenantHqActions(tenantId: string, limit = 20): Promise<HqAuditRow[]> {
  const result = await db.execute({
    sql: `SELECT * FROM hq_audit_log WHERE target_tenant_id = ? ORDER BY created_at DESC LIMIT ?`,
    args: [tenantId, limit],
  });
  return result.rows.map((row) => ({
    id: Number(row.id),
    hqUserId: (row.hq_user_id as string | null) ?? null,
    action: row.action as string,
    targetTenantId: (row.target_tenant_id as string | null) ?? null,
    metadata: (row.metadata as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}
