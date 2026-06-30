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
  setTenantCompFromJoin,
  setTenantStripeFields,
  setTenantPaidLocations,
  neutraliseCustomerPlaceholder,
} from "@/lib/queries/tenants";
import { getSignupLinkByToken, consumeSignupLink } from "@/lib/queries/signup-links";
import { stripe } from "@/lib/stripe";
import { getSubscriptionQuantity } from "@/lib/seats";
import { handleGateCallback } from "./gate";

const COOKIE_TENANT = "tenant_id";
const JOIN_COMP_COOKIE = "sp_join_comp";
const JOIN_MAGIC_COOKIE = "sp_join_magic";
const SIXTY_DAYS = 60 * 60 * 24 * 60;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state") ?? "";

  // Private-beta gate login reuses this same OAuth callback (so we don't have to
  // register a second redirect URI on the Meta app). The `gate:` state prefix —
  // set by /api/auth/gate/start — routes it to the identity+allowlist branch,
  // which never creates a tenant. Onboarding logins use a random hex state and
  // fall through to the existing flow below.
  if (state.startsWith("gate:")) {
    return handleGateCallback(request, code, error, state);
  }

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

    // HQ prepaid join: /join/<token> set sp_join_comp (the link's opaque
    // 32-byte token) before OAuth. Flag the tenant we land on as comped — but
    // ONLY after re-resolving the link server-side and re-verifying it's a
    // still-redeemable prepaid link. The token is unguessable, so the cookie
    // can't be forged to mint free access (unlike a bare numeric id). Consume
    // the link here, at the moment comp is actually granted.
    const joinCompToken = request.cookies.get(JOIN_COMP_COOKIE)?.value ?? null;
    const joinMagicToken = request.cookies.get(JOIN_MAGIC_COOKIE)?.value ?? null;
    // Paid signup: the Stripe checkout session id rides in the OAuth `state`
    // (chk:<id>) from /onboarding/connect, so we can attach the subscription to
    // THIS IG-keyed tenant instead of leaving it orphaned on a cust_ placeholder.
    const checkoutSessionId = state.startsWith("chk:") ? state.slice(4) : null;
    const clearJoinCookie = (response: NextResponse, name: string) => {
      response.cookies.set({
        name,
        value: "",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    };
    const applyJoinComp = async (response: NextResponse, tenantId: string) => {
      if (!joinCompToken) return;
      clearJoinCookie(response, JOIN_COMP_COOKIE);
      try {
        const link = await getSignupLinkByToken(joinCompToken);
        if (!link || link.type !== "prepaid") return;
        // Reserve the use atomically BEFORE granting comp — closes the TOCTOU
        // where two concurrent callbacks could both comp off one max_uses=1 link.
        if (await consumeSignupLink(link.id)) {
          await setTenantCompFromJoin(tenantId, link.id);
        }
      } catch {
        /* non-fatal — they can still be comped manually in HQ */
      }
    };
    // Magic re-invite: bind the target tenant ONLY to its authenticated owner.
    // The tenant cookie is already set to the resolved tenant; we only consume
    // the link when the person who just authenticated IS the target tenant (their
    // Instagram resolved to targetTenantId). A leaked/forwarded magic URL resolves
    // to the redeemer's OWN tenant, never matches, and grants nothing.
    const applyJoinMagic = async (response: NextResponse, resolvedTenantId: string) => {
      if (!joinMagicToken) return;
      clearJoinCookie(response, JOIN_MAGIC_COOKIE);
      try {
        const link = await getSignupLinkByToken(joinMagicToken);
        if (!link || link.type !== "magic") return;
        if (!link.targetTenantId || link.targetTenantId !== resolvedTenantId) {
          // Present but the authenticated identity isn't the link's target tenant
          // — by design we grant nothing, but log it so a mis-sent magic link is
          // visible rather than silently doing nothing.
          console.warn(
            `[oauth] magic link did not bind: target=${link.targetTenantId} resolved=${resolvedTenantId}`,
          );
          return;
        }
        await consumeSignupLink(link.id);
      } catch {
        /* non-fatal */
      }
    };
    // Paid checkout reconcile: pull the subscription off the Stripe checkout
    // session and stamp it onto the real IG-keyed tenant, then neutralise the
    // cust_<id> placeholder the webhook may have created. Reads Stripe directly,
    // so it works whether or not the webhook has fired yet (both race orders).
    const applyCheckoutSubscription = async (response: NextResponse, tenantId: string) => {
      if (!checkoutSessionId) return;
      try {
        const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
          expand: ["subscription"],
        });
        if (session.mode !== "subscription") return;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
        if (!customerId) return;
        const sub = session.subscription;
        const subscriptionId = typeof sub === "string" ? sub : sub?.id ?? null;
        const status = typeof sub === "object" && sub?.status ? sub.status : "active";
        await setTenantStripeFields(tenantId, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: status,
        });
        // Stamp the paid-seat count (= subscription quantity) onto the IG tenant
        // so the locations gate works straight away, before any webhook fires.
        if (subscriptionId) {
          const qty =
            (typeof sub === "object" ? sub?.items?.data?.[0]?.quantity : undefined) ??
            (await getSubscriptionQuantity(subscriptionId));
          if (qty != null) await setTenantPaidLocations(tenantId, qty);
        }
        await neutraliseCustomerPlaceholder(tenantId, customerId);
      } catch (err) {
        console.error("[oauth] checkout subscription reconcile failed", err);
      }
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
      await applyJoinComp(response, tenantId);
      await applyJoinMagic(response, tenantId);
      await applyCheckoutSubscription(response, tenantId);
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
    await applyJoinComp(response, tenantId);
    await applyJoinMagic(response, tenantId);
    // Single-Page buyers reach here too — attach the paid Stripe sub to this
    // IG-keyed tenant, same as the multi-Page branch above. Without this the
    // sub stays orphaned on the cust_ placeholder, the tenant keeps
    // subscription_status='pending', and the dashboard bounces them to /pricing
    // after they fully connected (the dominant one-Page local-business case).
    await applyCheckoutSubscription(response, tenantId);
    return response;
  } catch (err) {
    console.error("Facebook OAuth callback error:", err);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Authentication failed. Please try again.");
    return NextResponse.redirect(loginUrl);
  }
}
