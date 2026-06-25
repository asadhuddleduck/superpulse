import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
  createHmac,
} from "node:crypto";
import {
  getHqUserById,
  getHqSessionByTokenHash,
  insertHqSession,
  revokeHqSession,
  insertHqResetToken,
  getHqResetToken,
  type HqUser,
  type HqRole,
} from "@/lib/queries/hq-users";

// A cookie shape accepted by BOTH NextResponse.cookies.set() and the next/headers
// cookies() store, so route handlers can attach cookies to their response (the
// reliable way to ship Set-Cookie alongside a redirect).
export interface CookieDescriptor {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
}

// Security core for the Agency HQ console. Runs in Node route handlers + server
// components only (uses node:crypto) — never in edge middleware. Middleware does
// a coarse cookie-presence check; THIS module is the authoritative validator.

export const HQ_SESSION_COOKIE = "sp_hq";
export const HQ_IMPERSONATE_COOKIE = "sp_impersonate";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const IMPERSONATE_TTL_SECONDS = 60 * 60 * 2; // 2 hours
const RESET_TTL_SECONDS = 60 * 60; // 1 hour
const INVITE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// ---------------------------------------------------------------------------
// Hashing primitives
// ---------------------------------------------------------------------------

const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const SCRYPT_KEYLEN = 64;

/** scrypt password hash. Format: scrypt$N$r$p$<saltB64>$<hashB64>. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_r}$${SCRYPT_p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/** Constant-time password verify against a stored scrypt hash. */
export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const actual = scryptSync(password, salt, expected.length, {
      N: Number(nStr),
      r: Number(rStr),
      p: Number(pStr),
      maxmem: 64 * 1024 * 1024,
    });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function sha256hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function randomToken(): string {
  return randomBytes(32).toString("hex");
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

function secure(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Build the session cookie descriptor (path '/' so it rides on /dashboard too). */
export function hqSessionCookie(token: string, maxAge = SESSION_TTL_SECONDS): CookieDescriptor {
  return {
    name: HQ_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: secure(),
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export function clearHqSessionCookie(): CookieDescriptor {
  return hqSessionCookie("", 0);
}

/**
 * Mint + persist a session and return the raw token + cookie descriptor. The
 * caller attaches the cookie to its NextResponse (reliable with redirects).
 */
export async function mintHqSession(
  userId: string,
  userAgent?: string | null,
): Promise<{ token: string; cookie: CookieDescriptor }> {
  const token = randomToken();
  const tokenHash = sha256hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  const id = `hqs_${randomBytes(8).toString("hex")}`;
  await insertHqSession({ id, userId, tokenHash, expiresAt, userAgent });
  return { token, cookie: hqSessionCookie(token) };
}

/** Revoke the session backing a raw cookie token (for logout routes). */
export async function revokeHqSessionToken(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await revokeHqSession(sha256hex(token));
}

/**
 * Authoritative session resolver: read cookie -> session row -> user. Returns
 * the HqUser only if the session is unexpired + unrevoked AND the user is active.
 */
export async function getHqUser(): Promise<HqUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(HQ_SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await getHqSessionByTokenHash(sha256hex(token));
  if (!session) return null;
  if (session.revokedAt) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;
  const user = await getHqUserById(session.userId);
  if (!user || user.status !== "active") return null;
  return user;
}

/** Redirect to /admin/login unless a valid HQ session is present. */
export async function requireHqUser(): Promise<HqUser> {
  const user = await getHqUser();
  if (!user) redirect("/admin/login");
  return user;
}

const ROLE_RANK: Record<HqRole, number> = { member: 1, admin: 2, owner: 3 };

/** Require at least the given role. Redirects to /admin if under-privileged. */
export async function requireRole(min: HqRole): Promise<HqUser> {
  const user = await requireHqUser();
  if (ROLE_RANK[user.role] < ROLE_RANK[min]) redirect("/admin?error=forbidden");
  return user;
}

export async function hasRole(user: HqUser, min: HqRole): Promise<boolean> {
  return ROLE_RANK[user.role] >= ROLE_RANK[min];
}

// ---------------------------------------------------------------------------
// One-time tokens (password reset + invite "set your password")
// ---------------------------------------------------------------------------

/** Mint a reset/invite token, store its hash, return the RAW token for the link. */
export async function createResetToken(
  userId: string,
  purpose: "reset" | "invite",
): Promise<string> {
  const token = randomToken();
  const ttl = purpose === "invite" ? INVITE_TTL_SECONDS : RESET_TTL_SECONDS;
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  await insertHqResetToken({ tokenHash: sha256hex(token), userId, purpose, expiresAt });
  return token;
}

/** Validate a raw reset/invite token. Returns the user id + purpose, or null. */
export async function verifyResetToken(
  rawToken: string,
): Promise<{ userId: string; purpose: string; tokenHash: string } | null> {
  if (!rawToken) return null;
  const tokenHash = sha256hex(rawToken);
  const rec = await getHqResetToken(tokenHash);
  if (!rec) return null;
  if (rec.usedAt) return null;
  if (new Date(rec.expiresAt).getTime() < Date.now()) return null;
  return { userId: rec.userId, purpose: rec.purpose, tokenHash };
}

// ---------------------------------------------------------------------------
// Impersonation ("view as client") — signed cookie, read-only
// ---------------------------------------------------------------------------

interface ImpersonationPayload {
  tenantId: string;
  hqUserId: string;
  exp: number;
}

function impersonationSecret(): string {
  const s = process.env.HQ_SIGNING_SECRET;
  if (!s) throw new Error("HQ_SIGNING_SECRET is not set");
  return s;
}

function b64url(input: Buffer | string): string {
  return (typeof input === "string" ? Buffer.from(input) : input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function signImpersonation(payload: ImpersonationPayload): string {
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", impersonationSecret()).update(body).digest();
  return `${body}.${b64url(sig)}`;
}

function verifyImpersonation(token: string): ImpersonationPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sigB64] = parts;
  let expected: Buffer;
  let actual: Buffer;
  try {
    expected = createHmac("sha256", impersonationSecret()).update(body).digest();
    actual = b64urlDecode(sigB64);
  } catch {
    return null;
  }
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf-8")) as ImpersonationPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Mint a signed impersonation token (caller attaches the cookie to a response). */
export function mintImpersonationToken(tenantId: string, hqUserId: string): string {
  const exp = Math.floor(Date.now() / 1000) + IMPERSONATE_TTL_SECONDS;
  return signImpersonation({ tenantId, hqUserId, exp });
}

export function impersonationCookie(token: string): CookieDescriptor {
  return {
    name: HQ_IMPERSONATE_COOKIE,
    value: token,
    httpOnly: true,
    secure: secure(),
    sameSite: "lax",
    path: "/",
    maxAge: IMPERSONATE_TTL_SECONDS,
  };
}

export function clearImpersonationCookie(): CookieDescriptor {
  return {
    name: HQ_IMPERSONATE_COOKIE,
    value: "",
    httpOnly: true,
    secure: secure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}

/**
 * Resolve an active impersonation: a valid signed cookie AND a still-live HQ
 * session for the same operator (so disabling/logging out an operator kills
 * their impersonation too). Returns the impersonated tenantId, or null.
 */
export async function getImpersonation(): Promise<{ tenantId: string; hqUser: HqUser } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(HQ_IMPERSONATE_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyImpersonation(token);
  if (!payload) return null;
  const hqUser = await getHqUser();
  if (!hqUser || hqUser.id !== payload.hqUserId) return null;
  return { tenantId: payload.tenantId, hqUser };
}

/** Cheap presence check used by auth.ts (no signature verify needed there). */
export async function getImpersonatedTenantId(): Promise<string | null> {
  const imp = await getImpersonation();
  return imp?.tenantId ?? null;
}

/**
 * Guard for mutating customer routes. Throws if an impersonation cookie is
 * present so "view as client" can never write to a client's account.
 */
export async function assertNotImpersonating(): Promise<void> {
  const cookieStore = await cookies();
  if (cookieStore.get(HQ_IMPERSONATE_COOKIE)?.value) {
    throw new Error("IMPERSONATING_READONLY");
  }
}

/** True if currently impersonating (for non-throwing callers). */
export async function isImpersonating(): Promise<boolean> {
  const cookieStore = await cookies();
  return Boolean(cookieStore.get(HQ_IMPERSONATE_COOKIE)?.value);
}

/**
 * Drop-in guard for mutating customer API routes: returns a 403 Response while
 * an operator is viewing-as-client (read-only), or null to proceed.
 *   const ro = await impersonationGuard(); if (ro) return ro;
 */
export async function impersonationGuard(): Promise<Response | null> {
  if (await isImpersonating()) {
    return new Response(
      JSON.stringify({ error: "read_only", message: "Viewing as client — exit to make changes." }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  }
  return null;
}
