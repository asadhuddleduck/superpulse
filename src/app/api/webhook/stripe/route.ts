import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import {
  createPendingTenant,
  getTenantByStripeCustomerId,
  setTenantStripeFields,
} from "@/lib/queries/tenants";
import { writeAuditEvent } from "@/lib/queries/audit-events";
import { updateLocalCampaignStatus, getActiveCampaigns } from "@/lib/queries/campaigns";
import { updateCampaignStatus } from "@/lib/facebook";
import { decryptIfNeeded } from "@/lib/crypto";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook handler. Verifies signature with STRIPE_WEBHOOK_SECRET, then
 * routes events to handlers. All handlers are idempotent (Stripe retries).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not configured" },
      { status: 500 },
    );
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid signature: ${err instanceof Error ? err.message : err}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        // Acknowledge and move on — we don't subscribe to other events.
        break;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook handler error" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return;

  const customerId = String(session.customer ?? "");
  const subscriptionId = String(session.subscription ?? "");
  const email = session.customer_details?.email ?? session.customer_email ?? "";

  if (!customerId || !email) return;

  // Idempotent: if a tenant already exists for this customer, just update.
  const existing = await getTenantByStripeCustomerId(customerId);
  if (existing) {
    await setTenantStripeFields(existing.id, {
      subscriptionStatus: "active",
      stripeSubscriptionId: subscriptionId || null,
      email,
    });
    await writeAuditEvent(
      existing.id,
      "subscription_changed",
      `Subscription activated (£300/mo)`,
      { customerId, subscriptionId },
    );
    return;
  }

  // Generate a stable tenant id from the customer id so OAuth callback can
  // upsert into the same row.
  const tenantId = `cust_${customerId.replace(/^cus_/, "")}`;
  await createPendingTenant(tenantId, {
    email,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId || null,
    subscriptionStatus: "active",
  });
  await writeAuditEvent(
    tenantId,
    "subscription_changed",
    `Subscription activated (£300/mo) — awaiting Instagram connection`,
    { customerId, subscriptionId, email },
  );
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const customerId = String(sub.customer);
  const tenant = await getTenantByStripeCustomerId(customerId);
  if (!tenant) return;

  // Map Stripe statuses to our enum.
  const statusMap: Record<string, string> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    unpaid: "past_due",
    canceled: "canceled",
    incomplete: "pending",
    incomplete_expired: "canceled",
  };
  const subscriptionStatus = statusMap[sub.status] ?? "pending";

  await setTenantStripeFields(tenant.id, {
    subscriptionStatus,
    stripeSubscriptionId: sub.id,
  });
  await writeAuditEvent(
    tenant.id,
    "subscription_changed",
    `Subscription status: ${subscriptionStatus}`,
    { stripeStatus: sub.status },
  );
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const customerId = String(sub.customer);
  const tenant = await getTenantByStripeCustomerId(customerId);
  if (!tenant) return;

  await setTenantStripeFields(tenant.id, {
    subscriptionStatus: "canceled",
  });

  // Pause all active campaigns via the Meta API. Best effort — failures here
  // shouldn't block the webhook ack since cron will eventually catch up.
  const campaigns = await getActiveCampaigns(tenant.id);
  // Decrypt the token from raw row to avoid double-decrypting through the helper.
  const tokenRow = await db.execute({
    sql: "SELECT meta_access_token FROM tenants WHERE id = ?",
    args: [tenant.id],
  });
  const rawToken = tokenRow.rows[0]?.meta_access_token as string | null;
  const token = decryptIfNeeded(rawToken);
  if (token) {
    for (const c of campaigns) {
      try {
        await updateCampaignStatus(c.metaCampaignId, "PAUSED", token);
        await updateLocalCampaignStatus(c.metaCampaignId, "PAUSED");
      } catch {
        // Skip — operator will pick up via audit_events.
      }
    }
  }

  await writeAuditEvent(
    tenant.id,
    "subscription_changed",
    "Subscription canceled — all campaigns paused",
    { campaignsPaused: campaigns.length },
  );
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = String(invoice.customer ?? "");
  if (!customerId) return;
  const tenant = await getTenantByStripeCustomerId(customerId);
  if (!tenant) return;

  await setTenantStripeFields(tenant.id, {
    subscriptionStatus: "past_due",
  });
  await writeAuditEvent(
    tenant.id,
    "subscription_changed",
    `Payment failed (invoice ${invoice.id}) — subscription past due`,
    { invoiceId: invoice.id, amountDue: invoice.amount_due },
  );
}
