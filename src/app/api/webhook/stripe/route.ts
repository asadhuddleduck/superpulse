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
import { updateNodeStatus } from "@/lib/facebook";
import { decryptIfNeeded } from "@/lib/crypto";
import { db } from "@/lib/db";
import { fireCapi } from "@/lib/meta-capi";
import { logServerError } from "@/lib/error-mapper";

export const dynamic = "force-dynamic";

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
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      case "charge.dispute.created":
        await handleDisputeCreated(event.data.object as Stripe.Dispute);
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
        break;
    }
  } catch (err) {
    logServerError("webhook", err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode === "payment") {
    await handleAuditPayment(session);
    return;
  }
  if (session.mode !== "subscription") return;

  const customerId = String(session.customer ?? "");
  const subscriptionId = String(session.subscription ?? "");
  const email = session.customer_details?.email ?? session.customer_email ?? "";

  if (!customerId || !email) return;

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

  const campaigns = await getActiveCampaigns(tenant.id);
  const tokenRow = await db.execute({
    sql: "SELECT meta_access_token FROM tenants WHERE id = ?",
    args: [tenant.id],
  });
  const rawToken = tokenRow.rows[0]?.meta_access_token as string | null;
  const token = decryptIfNeeded(rawToken);
  if (token) {
    for (const c of campaigns) {
      try {
        await updateNodeStatus(c.metaCampaignId, "PAUSED", token);
        await updateLocalCampaignStatus(c.metaCampaignId, "PAUSED");
      } catch {
        /* skip */
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

async function handleAuditPayment(session: Stripe.Checkout.Session) {
  const product = (session.metadata?.product ?? "").trim();
  if (product !== "audit-27" && product !== "audit-97") return;

  const sessionId = session.id;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const email = (
    session.metadata?.email ??
    session.customer_details?.email ??
    session.customer_email ??
    ""
  ).trim().toLowerCase();
  const name = (session.metadata?.name ?? session.customer_details?.name ?? "").trim();
  const ig = (session.metadata?.instagram_handle ?? "").trim();
  const parentSessionId = (session.metadata?.parent_session_id ?? "").trim() || null;
  const amountTotal = session.amount_total ?? 0;
  const currency = (session.currency ?? "gbp").toLowerCase();

  let phoneE164: string | undefined;
  if (email) {
    try {
      const wl = await db.execute({
        sql: `SELECT phone FROM waitlist WHERE email = ? LIMIT 1`,
        args: [email],
      });
      const row = wl.rows[0] as { phone?: string } | undefined;
      if (row?.phone) phoneE164 = row.phone;
    } catch {
      /* ignore */
    }
  }
  const phoneForDb = phoneE164 ?? session.customer_details?.phone ?? null;

  await db.execute({
    sql: `INSERT INTO audit_purchases
            (stripe_session_id, stripe_payment_intent_id, stripe_customer_id,
             email, name, phone, instagram_handle, tier, amount_total, currency,
             parent_session_id, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'webhook')
          ON CONFLICT(stripe_session_id) DO NOTHING`,
    args: [
      sessionId,
      paymentIntentId,
      customerId,
      email,
      name || null,
      phoneForDb,
      ig || null,
      product,
      amountTotal,
      currency,
      parentSessionId,
    ],
  });

  if (email && sessionId) {
    await fireCapi({
      event_name: "Purchase",
      event_id: sessionId,
      email,
      phone_e164: phoneE164,
      first_name: name || undefined,
      value: amountTotal / 100,
      currency: currency.toUpperCase(),
      source_url: process.env.NEXT_PUBLIC_BASE_URL
        ? `${process.env.NEXT_PUBLIC_BASE_URL}/waitlist/upsell`
        : undefined,
    });
  }
}

async function handlePaymentIntentSucceeded(intent: Stripe.PaymentIntent) {
  const product = (intent.metadata?.product ?? "").trim();
  if (product !== "audit-97") return;

  const existing = await db.execute({
    sql: `SELECT id FROM audit_purchases WHERE stripe_payment_intent_id = ? LIMIT 1`,
    args: [intent.id],
  });
  if (existing.rows[0]) return;

  const customerId = typeof intent.customer === "string" ? intent.customer : intent.customer?.id ?? null;
  const email = (intent.metadata?.email ?? intent.receipt_email ?? "").trim().toLowerCase();
  const name = (intent.metadata?.name ?? "").trim();
  const ig = (intent.metadata?.instagram_handle ?? "").trim();
  const parentSessionId = (intent.metadata?.parent_session_id ?? "").trim() || null;

  let phoneE164: string | undefined;
  if (email) {
    try {
      const wl = await db.execute({
        sql: `SELECT phone FROM waitlist WHERE email = ? LIMIT 1`,
        args: [email],
      });
      const row = wl.rows[0] as { phone?: string } | undefined;
      if (row?.phone) phoneE164 = row.phone;
    } catch {
      /* ignore */
    }
  }

  await db.execute({
    sql: `INSERT INTO audit_purchases
            (stripe_session_id, stripe_payment_intent_id, stripe_customer_id,
             email, name, phone, instagram_handle, tier, amount_total, currency,
             parent_session_id, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'audit-97', ?, ?, ?, 'webhook-pi')
          ON CONFLICT(stripe_session_id) DO NOTHING`,
    args: [
      `oneclick:${intent.id}`,
      intent.id,
      customerId,
      email,
      name || null,
      phoneE164 ?? null,
      ig || null,
      intent.amount_received ?? intent.amount,
      (intent.currency || "gbp").toLowerCase(),
      parentSessionId,
    ],
  });
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const piId = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : charge.payment_intent?.id ?? null;
  if (!piId) return;
  await db.execute({
    sql: `UPDATE audit_purchases SET refunded = 1 WHERE stripe_payment_intent_id = ?`,
    args: [piId],
  });
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const piId = typeof dispute.payment_intent === "string"
    ? dispute.payment_intent
    : dispute.payment_intent?.id ?? null;
  console.warn("[stripe.dispute]", piId, dispute.reason, dispute.amount);
}
