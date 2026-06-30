import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, mapSubscriptionStatus } from "@/lib/stripe";
import {
  createPendingTenant,
  getTenantByStripeCustomerId,
  setTenantStripeFields,
  setTenantPaidLocations,
} from "@/lib/queries/tenants";
import { writeAuditEvent } from "@/lib/queries/audit-events";
import { updateLocalCampaignStatus, getActiveCampaigns } from "@/lib/queries/campaigns";
import { updateNodeStatus } from "@/lib/facebook";
import { decryptIfNeeded } from "@/lib/crypto";
import { db } from "@/lib/db";
import { fireCapi } from "@/lib/meta-capi";
import { logServerError } from "@/lib/error-mapper";
import { notifySlack } from "@/lib/slack";
import { sendAuditConfirmation } from "@/lib/email/confirmation";
import { isUnlimitedSeats } from "@/lib/seats";

function gbp(pennies: number | null | undefined): string {
  return `£${((pennies ?? 0) / 100).toFixed(2)}`;
}

// Per-location subscriptions: quantity = number of locations, unit = £27. Read
// the live subscription so logs/Slack and the synced seat count reflect the real
// amount, not a hardcoded flat price.
async function summariseSubscription(
  subscriptionId: string,
): Promise<{ quantity: number; totalPennies: number; label: string } | null> {
  if (!subscriptionId) return null;
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const item = sub.items?.data?.[0];
    const quantity = item?.quantity ?? 1;
    const unit = item?.price?.unit_amount ?? 0;
    const totalPennies = unit * quantity;
    const label = `${gbp(totalPennies)}/mo (${quantity} location${quantity === 1 ? "" : "s"})`;
    return { quantity, totalPennies, label };
  } catch (err) {
    console.error("[webhook] summariseSubscription failed", err);
    return null;
  }
}

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

  const summary = subscriptionId ? await summariseSubscription(subscriptionId) : null;
  const amountLabel = summary?.label ?? "per location";

  const existing = await getTenantByStripeCustomerId(customerId);
  if (existing) {
    await setTenantStripeFields(existing.id, {
      subscriptionStatus: "active",
      stripeSubscriptionId: subscriptionId || null,
      email,
    });
    if (summary) await setTenantPaidLocations(existing.id, summary.quantity);
    await writeAuditEvent(
      existing.id,
      "subscription_changed",
      `Subscription activated (${amountLabel})`,
      { customerId, subscriptionId, locations: summary?.quantity },
    );
    void notifySlack(`🟢 Subscription reactivated (${amountLabel})\n*Email:* ${email}`);
    return;
  }

  const tenantId = `cust_${customerId.replace(/^cus_/, "")}`;
  await createPendingTenant(tenantId, {
    email,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId || null,
    subscriptionStatus: "active",
  });
  if (summary) await setTenantPaidLocations(tenantId, summary.quantity);
  await writeAuditEvent(
    tenantId,
    "subscription_changed",
    `Subscription activated (${amountLabel}) — awaiting Instagram connection`,
    { customerId, subscriptionId, email, locations: summary?.quantity },
  );
  void notifySlack(
    `🟢 New SuperPulse subscription (${amountLabel})\n*Email:* ${email}\nAwaiting Instagram connection.`,
  );
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const customerId = String(sub.customer);
  const tenant = await getTenantByStripeCustomerId(customerId);
  if (!tenant) return;

  // Shared with the OAuth checkout reconcile so both write paths gate identically.
  const subscriptionStatus = mapSubscriptionStatus(sub.status);

  // Sync the paid-seat count back whenever the quantity changes (self-serve seat
  // add, an HQ change, or a Stripe-dashboard edit all land here).
  const quantity = sub.items?.data?.[0]?.quantity;

  await setTenantStripeFields(tenant.id, {
    subscriptionStatus,
    stripeSubscriptionId: sub.id,
  });
  if (typeof quantity === "number") {
    await setTenantPaidLocations(tenant.id, quantity);

    // A downgrade (Stripe-dashboard edit / HQ change) lowers the paid seat count
    // but does NOT touch existing locations rows, so an over-provisioned tenant
    // would keep running ad sets for locations no longer paid for (the reverse
    // gate only blocks ADDING). There's no pause flag on the locations table to
    // auto-reconcile safely, so surface it for manual action. Skip legacy/comp —
    // they're unlimited and bypass the seat gate.
    if (!isUnlimitedSeats(tenant)) {
      const locCount = await db.execute({
        sql: `SELECT COUNT(*) AS n FROM locations WHERE tenant_id = ?`,
        args: [tenant.id],
      });
      const currentLocations = Number(locCount.rows[0]?.n ?? 0);
      if (currentLocations > quantity) {
        const excess = currentLocations - quantity;
        void notifySlack(
          `⚠️ SuperPulse downgrade leaves unpaid locations\n*Email:* ${tenant.email ?? customerId}\n*Paid seats now:* ${quantity}\n*Locations on file:* ${currentLocations}\nRemove ${excess} location${excess === 1 ? "" : "s"} so we're not running ads for unpaid seats.`,
        );
      }
    }
  }
  await writeAuditEvent(
    tenant.id,
    "subscription_changed",
    `Subscription status: ${subscriptionStatus}` +
      (typeof quantity === "number"
        ? ` (${quantity} location${quantity === 1 ? "" : "s"})`
        : ""),
    { stripeStatus: sub.status, quantity },
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
  void notifySlack(
    `🔴 Payment failed — subscription past due\n*Email:* ${tenant.email ?? customerId}\n*Amount due:* ${gbp(invoice.amount_due)}`,
  );
}

async function handleAuditPayment(session: Stripe.Checkout.Session) {
  const product = (session.metadata?.product ?? "").trim();

  // £90 onboarding handhold — a one-off "we'll connect it for you" call. The
  // value is that Asad is told to action it, so persist a durable row first
  // (reusing audit_purchases with tier='handhold') and only alert on a genuinely
  // new row. This survives a dropped/failed fire-and-forget Slack notify and
  // dedupes a Stripe at-least-once redelivery so the same buyer isn't actioned
  // twice. tier='handhold' (NOT audit-27) keeps it out of the auto-fulfilment
  // cron, which only pulls tier='audit-27' rows.
  if (product === "onboarding-handhold") {
    const sessionId = session.id;
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;
    const customerId =
      typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
    const email = (
      session.customer_details?.email ??
      session.customer_email ??
      ""
    ).trim().toLowerCase();
    const name = (session.customer_details?.name ?? "").trim();
    const phone = session.customer_details?.phone ?? null;
    const amountTotal = session.amount_total ?? 0;
    const currency = (session.currency ?? "gbp").toLowerCase();

    const handholdIns = await db.execute({
      sql: `INSERT INTO audit_purchases
              (stripe_session_id, stripe_payment_intent_id, stripe_customer_id,
               email, name, phone, instagram_handle, tier, amount_total, currency,
               parent_session_id, source)
            VALUES (?, ?, ?, ?, ?, ?, NULL, 'handhold', ?, ?, NULL, 'webhook')
            ON CONFLICT(stripe_session_id) DO NOTHING`,
      args: [
        sessionId,
        paymentIntentId,
        customerId,
        email,
        name || null,
        phone,
        amountTotal,
        currency,
      ],
    });

    // Awaited (not fire-and-forget) so the serverless invocation can't be frozen
    // before the Slack POST completes; gated on a new row so a redelivery is silent.
    if (handholdIns.rowsAffected > 0) {
      await notifySlack(
        `🤝 £90 onboarding handhold purchased (${gbp(amountTotal)})\n*Email:* ${email || "unknown"}` +
          (name ? `\n*Name:* ${name}` : "") +
          `\nGet on a call and connect SuperPulse for them.`,
      );
    }
    return;
  }

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

  const auditIns = await db.execute({
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

  const label = product === "audit-97" ? "£97 Loom upsell" : "£27 audit";
  void notifySlack(
    `💷 ${label} purchased (${gbp(amountTotal)})\n*Email:* ${email || "unknown"}` +
      (name ? `\n*Name:* ${name}` : "") +
      (ig ? `\n*Instagram:* @${ig}` : ""),
  );

  // Branded SuperPulse confirmation — only on a genuinely new purchase row.
  if (auditIns.rowsAffected > 0 && email) {
    void sendAuditConfirmation(email, name.split(" ")[0] ?? "", product === "audit-97" ? "audit-97" : "audit-27");
  }

  // Enrol new £27 audits into auto-fulfilment. /api/cron/audit-fulfilment generates
  // the PDF and sends it ~1h later. No-op unless AUDIT_AUTOFULFIL_ENABLED=1 at cron time.
  if (auditIns.rowsAffected > 0 && product === "audit-27") {
    await db.execute({
      sql: `UPDATE audit_purchases SET audit_status='new' WHERE stripe_session_id=?`,
      args: [sessionId],
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

  const piIns = await db.execute({
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

  if (email) {
    await fireCapi({
      event_name: "Purchase",
      event_id: `oneclick:${intent.id}`,
      email,
      phone_e164: phoneE164,
      first_name: name || undefined,
      value: (intent.amount_received ?? intent.amount ?? 0) / 100,
      currency: (intent.currency || "gbp").toUpperCase(),
    });
  }

  void notifySlack(
    `💷 £97 Loom upsell purchased (${gbp(intent.amount_received ?? intent.amount)})\n*Email:* ${email || "unknown"}` +
      (name ? `\n*Name:* ${name}` : "") +
      (ig ? `\n*Instagram:* @${ig}` : ""),
  );

  if (piIns.rowsAffected > 0 && email) {
    void sendAuditConfirmation(email, name.split(" ")[0] ?? "", "audit-97");
  }
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
  void notifySlack(
    `↩️ Refund issued (${gbp(charge.amount_refunded)})\n*Email:* ${charge.billing_details?.email ?? charge.receipt_email ?? piId}`,
  );
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const piId = typeof dispute.payment_intent === "string"
    ? dispute.payment_intent
    : dispute.payment_intent?.id ?? null;
  console.warn("[stripe.dispute]", piId, dispute.reason, dispute.amount);
  void notifySlack(
    `⚠️ Dispute opened (${gbp(dispute.amount)})\n*Reason:* ${dispute.reason}\n*Payment:* ${piId ?? "unknown"}`,
  );
}
