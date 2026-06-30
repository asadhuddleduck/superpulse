import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getTenantById, type Tenant } from "@/lib/queries/tenants";
import { getImpersonatedTenantId } from "@/lib/hq-auth";

const TENANT_COOKIE_NAME = "tenant_id";
// Legacy cookie kept here only so logout can scrub any stale value left over
// from before the tenant-id-only migration.
const LEGACY_FB_TOKEN_COOKIE = "fb_access_token";

const SIXTY_DAYS_SECONDS = 60 * 60 * 24 * 60;

// ---------------------------------------------------------------------------
// Tenant cookie signing
//
// The tenant cookie is the ONLY credential for the customer app — getCurrentTenant
// trusts whatever tenant id it resolves to (decrypted Meta token + ad spend). A
// bare plaintext id could be forged in devtools/a proxy to impersonate any tenant
// (e.g. a legacy paying client), so the value MUST be tamper-proof. We HMAC-sign
// the id and verify it in constant time before trusting it — the same primitive
// hq-auth.ts uses for the impersonation cookie. The signed message is domain-
// separated ("tenant.v1:") so a signature minted for any other scheme that shares
// the secret can never be replayed as a tenant cookie. Reuses HQ_SIGNING_SECRET
// (already present in every environment that runs the HQ console) and fails closed
// if it is missing.
function authSecret(): string {
  const s = process.env.HQ_SIGNING_SECRET;
  if (!s) throw new Error("HQ_SIGNING_SECRET is not set");
  return s;
}

function tenantSignature(tenantId: string): string {
  return createHmac("sha256", authSecret())
    .update(`tenant.v1:${tenantId}`)
    .digest("base64url");
}

/**
 * Cookie value format: `<tenantId>.<hmac>`. Exported so the OAuth callback — which
 * ships its Set-Cookie on its own NextResponse — emits the identical signed value.
 */
export function signTenantId(tenantId: string): string {
  return `${tenantId}.${tenantSignature(tenantId)}`;
}

/** Verify a signed cookie value and return the tenant id, or null if tampered. */
function verifyTenantCookie(value: string): string | null {
  // Split on the LAST dot: the base64url signature never contains a dot, so this
  // is robust even if a tenant id ever did.
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const tenantId = value.slice(0, dot);
  const expected = Buffer.from(tenantSignature(tenantId));
  const actual = Buffer.from(value.slice(dot + 1));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  return tenantId;
}

export async function getTenantCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(TENANT_COOKIE_NAME)?.value;
  if (!raw) return null;
  // Reject unsigned/forged values — a stale pre-signing plaintext cookie resolves
  // to null here, forcing a fresh Facebook login (the secure path).
  return verifyTenantCookie(raw);
}

export async function setTenantCookie(tenantId: string) {
  const cookieStore = await cookies();
  cookieStore.set(TENANT_COOKIE_NAME, signTenantId(tenantId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SIXTY_DAYS_SECONDS,
  });
}

export async function clearTokenCookie() {
  const cookieStore = await cookies();
  for (const name of [TENANT_COOKIE_NAME, LEGACY_FB_TOKEN_COOKIE]) {
    cookieStore.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}

/**
 * Return the currently signed-in tenant, or null if no valid tenant cookie.
 * The returned `metaAccessToken` is decrypted by the query layer.
 *
 * Agency HQ: if a valid "view as client" impersonation is active (signed cookie
 * + live HQ session), this resolves to the impersonated tenant instead — so the
 * real /dashboard + /onboarding screens render exactly as that client sees them.
 * Writes are blocked separately via assertNotImpersonating() in mutating routes.
 */
export async function getCurrentTenant(): Promise<Tenant | null> {
  const impersonatedId = await getImpersonatedTenantId();
  if (impersonatedId) {
    const impersonated = await getTenantById(impersonatedId);
    if (impersonated) return impersonated;
  }
  const tenantId = await getTenantCookie();
  if (!tenantId) return null;
  return getTenantById(tenantId);
}

/**
 * Decrypted Meta access token for the currently signed-in tenant.
 * Returns null if no tenant cookie or if the tenant has no token stored.
 */
export async function getCurrentToken(): Promise<string | null> {
  const tenant = await getCurrentTenant();
  return tenant?.metaAccessToken ?? null;
}
