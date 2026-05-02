import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchPagesWithIG,
  fetchIGUsername,
  fetchMe,
} from "@/lib/facebook";
import {
  getTenantByIgUserId,
  upsertTenant,
} from "@/lib/queries/tenants";

const COOKIE_TENANT = "tenant_id";
const SIXTY_DAYS = 60 * 60 * 24 * 60;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    const errorDescription = searchParams.get("error_description") ?? "Login was cancelled.";
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", errorDescription);
    return NextResponse.redirect(loginUrl);
  }

  const host = request.headers.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/auth/callback/facebook`;

  try {
    const shortLived = await exchangeCodeForToken(code, redirectUri);
    const longLived = await exchangeForLongLivedToken(shortLived.access_token);
    const token = longLived.access_token;

    const [me, pages] = await Promise.all([
      fetchMe(token).catch(() => null),
      fetchPagesWithIG(token).catch(() => []),
    ]);

    const pagesWithIG = pages.filter((p) => p.instagram_business_account);
    const expiresAt = new Date(
      Date.now() + (longLived.expires_in ?? SIXTY_DAYS) * 1000,
    ).toISOString();

    const setTenantCookie = (response: NextResponse, tenantId: string) => {
      response.cookies.set({
        name: COOKIE_TENANT,
        value: tenantId,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SIXTY_DAYS,
      });
    };

    // Multi-Page accounts route through the picker so the user chooses which
    // Page+IG to wire up. We persist the token immediately (encrypted at rest)
    // under a stable fb-id-keyed tenant so the picker has it available.
    if (pagesWithIG.length > 1) {
      const tenantId = me?.id ? `t_fb_${me.id}` : `t_pending_${Date.now()}`;
      await upsertTenant({
        id: tenantId,
        name: me?.name ?? null,
        metaAccessToken: token,
        status: "pending_page_selection",
        tokenExpiresAt: expiresAt,
      });
      const pickerUrl = new URL("/onboarding/select-page", request.url);
      const response = NextResponse.redirect(pickerUrl);
      setTenantCookie(response, tenantId);
      return response;
    }

    const pageWithIG = pagesWithIG[0] ?? null;
    const igUserId = pageWithIG?.instagram_business_account?.id ?? null;
    const pageId = pageWithIG?.id ?? null;
    const pageName = pageWithIG?.name ?? null;

    let igUsername: string | null = null;
    if (igUserId) {
      try {
        igUsername = await fetchIGUsername(igUserId, token);
      } catch {
        // Username fetch is best-effort; cron can backfill later.
      }
    }

    // Match against existing tenant by ig_user_id (lets us pre-seed PhatBuns
    // and Henny's so they slide straight into 'active' without a picker).
    let tenantId: string;
    let tenantName: string | null = pageName ?? me?.name ?? null;
    let existingHasAdAccount = false;

    if (igUserId) {
      const existing = await getTenantByIgUserId(igUserId);
      if (existing) {
        tenantId = existing.id;
        tenantName = existing.name ?? tenantName;
        existingHasAdAccount = !!existing.adAccountId;
      } else {
        tenantId = `t_${igUserId}`;
      }
    } else {
      tenantId = me?.id ? `t_fb_${me.id}` : `t_${Date.now()}`;
    }

    // Existing tenants that already have an ad_account_id are grandfathered —
    // we trust their prior pick and do NOT force them through the picker on
    // every refresh. Brand-new tenants always go to /onboarding/select-ad-account
    // so an explicit choice is recorded (no more silent adAccounts[0] binding).
    const nextStatus = existingHasAdAccount ? "active" : "pending_ad_account";

    await upsertTenant({
      id: tenantId,
      igUserId,
      pageId,
      igUsername,
      name: tenantName,
      metaAccessToken: token,
      status: nextStatus,
      tokenExpiresAt: expiresAt,
    });

    const nextUrl = nextStatus === "active"
      ? new URL("/dashboard", request.url)
      : new URL("/onboarding/select-ad-account", request.url);
    const response = NextResponse.redirect(nextUrl);
    setTenantCookie(response, tenantId);
    return response;
  } catch (err) {
    console.error("Facebook OAuth callback error:", err);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Authentication failed. Please try again.");
    return NextResponse.redirect(loginUrl);
  }
}
