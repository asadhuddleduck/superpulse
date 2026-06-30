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
  getTenantById,
  getTenantByEmail,
  getTenantByStripeCustomerId,
  upsertTenant,
  setTenantCompFromJoin,
  setTenantStripeFields,
  setTenantPaidLocations,
  setProvisioningStatus,
  neutraliseCustomerPlaceholder,
} from "@/lib/queries/tenants";
import { getSignupLinkByToken, consumeSignupLink } from "@/lib/queries/signup-links";
import { signTenantId } from "@/lib/auth";
import { stripe, mapSubscriptionStatus } from "@/lib/stripe";
import { getSubscriptionQuantity } from "@/lib/seats";
import { notifySlack } from "@/lib/slack";
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
        // HMAC-signed so the value can't be forged to impersonate a tenant
        // (see signTenantId / verifyTenantCookie in @/lib/auth).
        value: signTenantId(tenantId),
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
    const authedEmail = me?.email?.trim().toLowerCase() || null;

    // Durability fallback: if the live Stripe read fails mid-callback
    // (rate-limit/5xx/network blip), don't strand the paid customer on /pricing
    // with money orphaned on the cust_ placeholder. Recover the paid state from
    // the webhook-created cust_ placeholder (matched on the authenticated email)
    // so the attach completes without the live Stripe call succeeding.
    const recoverFromWebhookPlaceholder = async (tenantId: string) => {
      if (!authedEmail) return;
      try {
        const placeholder = await getTenantByEmail(authedEmail);
        if (
          !placeholder ||
          placeholder.id === tenantId ||
          !placeholder.id.startsWith("cust_") ||
          !placeholder.stripeCustomerId ||
          !["active", "trialing"].includes(placeholder.subscriptionStatus)
        ) {
          return;
        }
        // Don't orphan a different live sub already on this tenant.
        const current = await getTenantById(tenantId);
        if (
          current?.stripeSubscriptionId &&
          placeholder.stripeSubscriptionId &&
          current.stripeSubscriptionId !== placeholder.stripeSubscriptionId
        ) {
          return;
        }
        await setTenantStripeFields(tenantId, {
          stripeCustomerId: placeholder.stripeCustomerId,
          stripeSubscriptionId: placeholder.stripeSubscriptionId,
          subscriptionStatus: placeholder.subscriptionStatus,
        });
        if (placeholder.paidLocations != null) {
          await setTenantPaidLocations(tenantId, placeholder.paidLocations);
        }
        await neutraliseCustomerPlaceholder(tenantId, placeholder.stripeCustomerId);
      } catch (err) {
        console.error("[oauth] webhook placeholder fallback failed", err);
      }
    };

    const applyCheckoutSubscription = async (response: NextResponse, tenantId: string) => {
      if (!checkoutSessionId) return;

      // The checkout session id rides in the PUBLIC OAuth state — it is NOT a
      // bearer credential. The guards below (completed+paid, identity-bind,
      // single-customer binding) stop a leaked/forwarded/replayed session from
      // attaching one £27 sub to multiple IG tenants or hijacking the buyer's.
      const session = await stripe.checkout.sessions
        .retrieve(checkoutSessionId, { expand: ["subscription"] })
        .catch((err) => {
          console.error("[oauth] checkout session retrieve failed; trying webhook fallback", err);
          return null;
        });
      if (!session) {
        await recoverFromWebhookPlaceholder(tenantId);
        return;
      }

      try {
        if (session.mode !== "subscription") return;
        // Only a genuinely completed + paid checkout may grant billing state. A
        // 3DS/SCA-pending or open session must NOT read as active.
        // 'no_payment_required' covers a 100%-off first month (FIRSTMONTHFREE).
        if (
          session.status !== "complete" ||
          (session.payment_status !== "paid" &&
            session.payment_status !== "no_payment_required")
        ) {
          return;
        }
        // Identity-bind: the session's buyer email must match the authenticated
        // Facebook user, so a forwarded session link can't attach someone else's
        // sub to your tenant.
        const sessionEmail = (
          session.customer_details?.email ??
          session.customer_email ??
          ""
        )
          .trim()
          .toLowerCase();
        if (authedEmail && sessionEmail && sessionEmail !== authedEmail) {
          console.warn(
            `[oauth] checkout email ${sessionEmail} != authed ${authedEmail}; not attaching ${tenantId}`,
          );
          return;
        }
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
        if (!customerId) return;

        // Single-customer binding: if this customer is already bound to a DIFFERENT
        // real IG tenant, the session is being replayed onto another IG account.
        // Never re-stamp (that runs one sub across two tenants) and never neutralise
        // (which would brick the original buyer). cust_ placeholders are fine to take.
        const holder = await getTenantByStripeCustomerId(customerId);
        if (holder && holder.id !== tenantId && !holder.id.startsWith("cust_")) {
          console.warn(
            `[oauth] customer ${customerId} already bound to ${holder.id}; ignoring replay onto ${tenantId}`,
          );
          return;
        }

        const sub = session.subscription;
        const subscriptionId = typeof sub === "string" ? sub : sub?.id ?? null;
        const rawStatus = typeof sub === "object" && sub?.status ? sub.status : null;
        // Normalise through the same map the webhook uses — never write a raw
        // non-active status that would slip past the dashboard billing gate.
        const status = mapSubscriptionStatus(rawStatus);

        // Don't orphan an existing live subscription on a re-purchase: if this
        // tenant already references a DIFFERENT sub, the COALESCE write would
        // overwrite it and abandon the old one still billing in Stripe. Keep the
        // original, alert, and bail.
        const current = await getTenantById(tenantId);
        if (
          current?.stripeSubscriptionId &&
          subscriptionId &&
          current.stripeSubscriptionId !== subscriptionId
        ) {
          console.error(
            `[oauth] tenant ${tenantId} already on sub ${current.stripeSubscriptionId}; new ${subscriptionId} NOT attached`,
          );
          void notifySlack(
            `⚠️ SuperPulse: duplicate subscription for ${current.name ?? tenantId}. ` +
              `Kept ${current.stripeSubscriptionId}; new ${subscriptionId} (customer ${customerId}) NOT attached — cancel/refund the duplicate.`,
          );
          return;
        }

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
    let existingProvisionFailed = false;

    if (igUserId) {
      const existing = await getTenantByIgUserId(igUserId);
      if (existing) {
        tenantId = existing.id;
        tenantName = existing.name ?? tenantName;
        existingHasAdAccount = !!existing.adAccountId;
        existingProvisionFailed = existing.provisioningStatus === "provision_failed";
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

    // A tenant parked in 'provision_failed' is excluded from
    // getTenantsAwaitingProvision, so the provision cron never retries it. A Meta
    // access/token failure (expired token, not yet an app tester, ad-account
    // access lost) is exactly what this re-auth fixes — flip it back to
    // 'provisioning' so the cron re-enters. A budget-too-tight failure simply
    // re-fails on the next tick and the dashboard routes it to /onboarding/budget,
    // so this is safe for that case too. provisioning_status is inherently
    // v8-only state (NULL unless the v8 engine set it), so this no-ops elsewhere.
    if (existingProvisionFailed) {
      await setProvisioningStatus(tenantId, "provisioning");
    }

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
