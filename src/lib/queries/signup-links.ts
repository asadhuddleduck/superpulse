import { db } from "@/lib/db";
import { randomBytes } from "node:crypto";

// Join links a teammate hands to a prospective/known client.
//   paid    -> must check out (£300/mo, optional coupon) before access
//   prepaid -> comped: granted access with NO Stripe charge, straight to OAuth
//   magic   -> resume/re-invite bound to an existing tenant

export type SignupLinkType = "paid" | "prepaid" | "magic";

export interface SignupLink {
  id: number;
  token: string;
  type: SignupLinkType;
  label: string | null;
  email: string | null;
  stripeCoupon: string | null;
  targetTenantId: string | null;
  maxUses: number;
  usedCount: number;
  status: string; // active | revoked | used
  expiresAt: string | null;
  createdBy: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

function rowToLink(row: Record<string, unknown>): SignupLink {
  return {
    id: Number(row.id),
    token: row.token as string,
    type: ((row.type as string) ?? "paid") as SignupLinkType,
    label: (row.label as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    stripeCoupon: (row.stripe_coupon as string | null) ?? null,
    targetTenantId: (row.target_tenant_id as string | null) ?? null,
    maxUses: Number(row.max_uses ?? 1),
    usedCount: Number(row.used_count ?? 0),
    status: (row.status as string) ?? "active",
    expiresAt: (row.expires_at as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    lastUsedAt: (row.last_used_at as string | null) ?? null,
  };
}

export async function createSignupLink(input: {
  type: SignupLinkType;
  label?: string | null;
  email?: string | null;
  stripeCoupon?: string | null;
  targetTenantId?: string | null;
  maxUses?: number;
  expiresAt?: string | null;
  createdBy: string;
}): Promise<SignupLink> {
  const token = randomBytes(12).toString("base64url");
  await db.execute({
    sql: `INSERT INTO signup_links
            (token, type, label, email, stripe_coupon, target_tenant_id, max_uses, expires_at, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      token,
      input.type,
      input.label ?? null,
      input.email ? input.email.toLowerCase().trim() : null,
      input.stripeCoupon ?? null,
      input.targetTenantId ?? null,
      input.maxUses ?? 1,
      input.expiresAt ?? null,
      input.createdBy,
    ],
  });
  const link = await getSignupLinkByToken(token);
  if (!link) throw new Error("link insert failed");
  return link;
}

export async function getSignupLinkByToken(token: string): Promise<SignupLink | null> {
  const result = await db.execute({
    sql: `SELECT * FROM signup_links WHERE token = ? LIMIT 1`,
    args: [token],
  });
  return result.rows.length ? rowToLink(result.rows[0]) : null;
}

export async function listSignupLinks(): Promise<SignupLink[]> {
  const result = await db.execute({
    sql: `SELECT * FROM signup_links ORDER BY created_at DESC`,
    args: [],
  });
  return result.rows.map(rowToLink);
}

/** True if the link can still be redeemed right now. */
export function isLinkRedeemable(link: SignupLink): boolean {
  if (link.status !== "active") return false;
  if (link.usedCount >= link.maxUses) return false;
  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) return false;
  return true;
}

export async function recordLinkUse(id: number): Promise<void> {
  await db.execute({
    sql: `UPDATE signup_links
            SET used_count = used_count + 1,
                last_used_at = ?,
                status = CASE WHEN used_count + 1 >= max_uses THEN 'used' ELSE status END
          WHERE id = ?`,
    args: [new Date().toISOString(), id],
  });
}

/**
 * Atomically reserve ONE use of a link at grant time. A single conditional
 * UPDATE (no read-then-write TOCTOU): it increments used_count and flips status
 * -> 'used' at the cap, but ONLY while the link is still active, under its cap,
 * and unexpired. Returns true iff this call won the use (rowsAffected === 1).
 * Callers MUST gate the grant (comp / takeover / session) on a true result, and
 * call this at the moment access is granted, not at click time.
 */
export async function consumeSignupLink(id: number): Promise<boolean> {
  const now = new Date().toISOString();
  const res = await db.execute({
    sql: `UPDATE signup_links
            SET used_count = used_count + 1,
                last_used_at = ?,
                status = CASE WHEN used_count + 1 >= max_uses THEN 'used' ELSE status END
          WHERE id = ?
            AND status = 'active'
            AND used_count < max_uses
            AND (expires_at IS NULL OR expires_at > ?)`,
    args: [now, id, now],
  });
  return res.rowsAffected === 1;
}

export async function revokeSignupLink(id: number): Promise<void> {
  await db.execute({
    sql: `UPDATE signup_links SET status = 'revoked' WHERE id = ?`,
    args: [id],
  });
}
