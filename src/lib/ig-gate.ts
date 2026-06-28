// Private-beta gate logic.
//
// The gate reuses SuperPulse's OWN Facebook-Login OAuth (src/lib/facebook.ts)
// and its already-registered /api/auth/callback/facebook redirect URI — the
// same "log in and give us access to your Instagram" flow the product uses.
// On a successful login we read the account's IG @username and check it against
// an allowlist; a match sets the SAME `sp_gate` cookie the password form sets,
// so middleware.ts is untouched and the password stays as an invisible
// break-glass. Non-allowlisted logins are offered the waitlist.

export const GATE_COOKIE = "sp_gate";
export const GATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
export const GATE_OAUTH_COOKIE = "sp_gate_oauth";
export const GATE_STATE_PREFIX = "gate:"; // marks an OAuth round-trip as gate (not onboarding)

export function normalizeHandle(handle: string): string {
  // IG handles are [a-z0-9._], max 30. Strip anything else so a hostile
  // username can never carry markup/control chars into the reflected ?u=
  // param or the allowlist comparison.
  return handle
    .trim()
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 30);
}

/** Comma/whitespace-separated IG usernames from SUPERPULSE_GATE_IG_ALLOWLIST, normalised. */
export function getAllowlist(): string[] {
  return (process.env.SUPERPULSE_GATE_IG_ALLOWLIST ?? "")
    .split(/[,\s]+/)
    .map(normalizeHandle)
    .filter(Boolean);
}

export function isAllowed(username: string): boolean {
  return getAllowlist().includes(normalizeHandle(username));
}

/**
 * The gate-cookie value middleware.ts expects: sha256("sp-gate-v1:<password>").
 * Returns null if no password is configured (gate effectively disabled in dev).
 */
export async function gateCookieToken(): Promise<string | null> {
  const password = process.env.SUPERPULSE_GATE_PASSWORD;
  if (!password) return null;
  const data = new TextEncoder().encode(`sp-gate-v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Only same-origin absolute paths are valid post-login destinations. */
export function safeNext(next: string | null | undefined): string {
  if (!next) return "/";
  // Reject backslashes and C0 control chars (CR/LF/tab/null) BEFORE the prefix
  // checks: WHATWG `new URL()` normalises "/\evil.com" -> "//evil.com" -> a
  // cross-origin redirect, so "//"-only guarding is bypassable.
  if (/[\\\x00-\x1f]/.test(next)) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  if (next.startsWith("/gate")) return "/";
  return next;
}

const ALLOWED_HOSTS = ["superpulse.io", "www.superpulse.io"];

/**
 * Trusted absolute origin for building redirects, derived from the Host header
 * but never trusting it: only our own hosts (and localhost in dev) are honoured,
 * anything else falls back to the canonical production origin. Stops Host-header
 * injection from poisoning the OAuth redirect_uri or the post-login redirect.
 */
export function safeBaseUrl(host: string | null | undefined): string {
  const h = (host ?? "").toLowerCase().trim();
  if (ALLOWED_HOSTS.includes(h)) return `https://${h}`;
  if (h.startsWith("localhost") || h.startsWith("127.0.0.1")) return `http://${h}`;
  return "https://www.superpulse.io";
}

/**
 * Public client-facing origin for onboarding links (/join, /pricing, /onboarding).
 * NEVER the operator console host: admin.superpulse.io is console-only and bounces
 * every non-/admin path to the operator sign-in, so a join link built on the admin
 * host dead-ends at login. Prod → canonical public site; dev → strip the admin. prefix.
 */
export function publicAppOrigin(host: string | null | undefined): string {
  const h = (host ?? "").toLowerCase().trim();
  if (h.startsWith("admin.localhost")) return `http://${h.replace(/^admin\./, "")}`;
  if (h.startsWith("localhost") || h.startsWith("127.0.0.1")) return `http://${h}`;
  return "https://www.superpulse.io";
}
