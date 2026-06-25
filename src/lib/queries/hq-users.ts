import { db } from "@/lib/db";

// Row layer for the Agency HQ auth tables (hq_users / hq_sessions /
// hq_password_resets). Pure DB access — no crypto, no cookies. The security
// logic (hashing, token minting, cookie wiring) lives in src/lib/hq-auth.ts.

export type HqRole = "owner" | "admin" | "member";
export type HqStatus = "active" | "invited" | "disabled";

export interface HqUser {
  id: string;
  email: string;
  passwordHash: string | null;
  name: string | null;
  role: HqRole;
  status: HqStatus;
  invitedBy: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

function rowToHqUser(row: Record<string, unknown>): HqUser {
  return {
    id: row.id as string,
    email: row.email as string,
    passwordHash: (row.password_hash as string | null) ?? null,
    name: (row.name as string | null) ?? null,
    role: ((row.role as string | null) ?? "member") as HqRole,
    status: ((row.status as string | null) ?? "invited") as HqStatus,
    invitedBy: (row.invited_by as string | null) ?? null,
    createdAt: row.created_at as string,
    lastLoginAt: (row.last_login_at as string | null) ?? null,
  };
}

export async function createHqUser(u: {
  id: string;
  email: string;
  name?: string | null;
  role?: HqRole;
  status?: HqStatus;
  passwordHash?: string | null;
  invitedBy?: string | null;
}): Promise<void> {
  await db.execute({
    sql: `INSERT INTO hq_users (id, email, password_hash, name, role, status, invited_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      u.id,
      u.email.toLowerCase().trim(),
      u.passwordHash ?? null,
      u.name ?? null,
      u.role ?? "member",
      u.status ?? "invited",
      u.invitedBy ?? null,
    ],
  });
}

export async function getHqUserByEmail(email: string): Promise<HqUser | null> {
  const result = await db.execute({
    sql: `SELECT * FROM hq_users WHERE email = ? LIMIT 1`,
    args: [email.toLowerCase().trim()],
  });
  return result.rows.length ? rowToHqUser(result.rows[0]) : null;
}

export async function getHqUserById(id: string): Promise<HqUser | null> {
  const result = await db.execute({
    sql: `SELECT * FROM hq_users WHERE id = ? LIMIT 1`,
    args: [id],
  });
  return result.rows.length ? rowToHqUser(result.rows[0]) : null;
}

export async function listHqUsers(): Promise<HqUser[]> {
  const result = await db.execute({
    sql: `SELECT * FROM hq_users ORDER BY created_at ASC`,
    args: [],
  });
  return result.rows.map(rowToHqUser);
}

/** Count active owners — used to refuse any action that would remove the last one. */
export async function countActiveOwners(): Promise<number> {
  const result = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM hq_users WHERE role = 'owner' AND status = 'active'`,
    args: [],
  });
  return Number((result.rows[0] as { n?: number } | undefined)?.n ?? 0);
}

export async function setHqUserPassword(id: string, passwordHash: string): Promise<void> {
  await db.execute({
    sql: `UPDATE hq_users SET password_hash = ?, status = 'active' WHERE id = ?`,
    args: [passwordHash, id],
  });
}

export async function setHqUserStatus(id: string, status: HqStatus): Promise<void> {
  await db.execute({
    sql: `UPDATE hq_users SET status = ? WHERE id = ?`,
    args: [status, id],
  });
}

export async function setHqUserRole(id: string, role: HqRole): Promise<void> {
  await db.execute({
    sql: `UPDATE hq_users SET role = ? WHERE id = ?`,
    args: [role, id],
  });
}

export async function touchHqUserLogin(id: string): Promise<void> {
  await db.execute({
    sql: `UPDATE hq_users SET last_login_at = ? WHERE id = ?`,
    args: [new Date().toISOString(), id],
  });
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface HqSession {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

function rowToHqSession(row: Record<string, unknown>): HqSession {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    tokenHash: row.token_hash as string,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
    revokedAt: (row.revoked_at as string | null) ?? null,
  };
}

export async function insertHqSession(s: {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  userAgent?: string | null;
}): Promise<void> {
  await db.execute({
    sql: `INSERT INTO hq_sessions (id, user_id, token_hash, expires_at, user_agent)
          VALUES (?, ?, ?, ?, ?)`,
    args: [s.id, s.userId, s.tokenHash, s.expiresAt, s.userAgent ?? null],
  });
}

export async function getHqSessionByTokenHash(tokenHash: string): Promise<HqSession | null> {
  const result = await db.execute({
    sql: `SELECT * FROM hq_sessions WHERE token_hash = ? LIMIT 1`,
    args: [tokenHash],
  });
  return result.rows.length ? rowToHqSession(result.rows[0]) : null;
}

export async function revokeHqSession(tokenHash: string): Promise<void> {
  await db.execute({
    sql: `UPDATE hq_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL`,
    args: [new Date().toISOString(), tokenHash],
  });
}

export async function revokeAllHqSessionsForUser(userId: string): Promise<void> {
  await db.execute({
    sql: `UPDATE hq_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`,
    args: [new Date().toISOString(), userId],
  });
}

// ---------------------------------------------------------------------------
// One-time tokens (password reset + invite "set your password")
// ---------------------------------------------------------------------------

export interface HqResetToken {
  tokenHash: string;
  userId: string;
  purpose: string;
  expiresAt: string;
  usedAt: string | null;
}

export async function insertHqResetToken(t: {
  tokenHash: string;
  userId: string;
  purpose: "reset" | "invite";
  expiresAt: string;
}): Promise<void> {
  await db.execute({
    sql: `INSERT INTO hq_password_resets (token_hash, user_id, purpose, expires_at)
          VALUES (?, ?, ?, ?)`,
    args: [t.tokenHash, t.userId, t.purpose, t.expiresAt],
  });
}

export async function getHqResetToken(tokenHash: string): Promise<HqResetToken | null> {
  const result = await db.execute({
    sql: `SELECT * FROM hq_password_resets WHERE token_hash = ? LIMIT 1`,
    args: [tokenHash],
  });
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return {
    tokenHash: row.token_hash as string,
    userId: row.user_id as string,
    purpose: (row.purpose as string) ?? "reset",
    expiresAt: row.expires_at as string,
    usedAt: (row.used_at as string | null) ?? null,
  };
}

export async function markHqResetUsed(tokenHash: string): Promise<void> {
  await db.execute({
    sql: `UPDATE hq_password_resets SET used_at = ? WHERE token_hash = ?`,
    args: [new Date().toISOString(), tokenHash],
  });
}
