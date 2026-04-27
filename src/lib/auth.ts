import { cookies } from "next/headers";
import { getTenantById, type Tenant } from "@/lib/queries/tenants";

const TENANT_COOKIE_NAME = "tenant_id";
// Legacy cookie kept here only so logout can scrub any stale value left over
// from before the tenant-id-only migration.
const LEGACY_FB_TOKEN_COOKIE = "fb_access_token";

const SIXTY_DAYS_SECONDS = 60 * 60 * 24 * 60;

export async function getTenantCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(TENANT_COOKIE_NAME)?.value ?? null;
}

export async function setTenantCookie(tenantId: string) {
  const cookieStore = await cookies();
  cookieStore.set(TENANT_COOKIE_NAME, tenantId, {
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
 */
export async function getCurrentTenant(): Promise<Tenant | null> {
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
