// One-shot backfill for audit_purchases rows that Stripe failed to deliver
// because the webhook endpoint pointed at the apex domain (superpulse.io),
// which 307-redirects to www.superpulse.io. Stripe does not follow redirects,
// so checkout.session.completed events for these payments were never recorded.
//
// Fixed forward by re-pointing the webhook to https://www.superpulse.io/...
// This script recovers the payments that were lost in the gap.
//
// Idempotent: ON CONFLICT(stripe_session_id) DO NOTHING. Safe to re-run.
//
// Usage (from superpulse/):  node --env-file=.env.local scripts/backfill-audit-purchases.mjs
// Add --dry to preview without writing.

import { createClient } from "@libsql/client";
import Stripe from "stripe";
import { createHash } from "node:crypto";

const DRY = process.argv.includes("--dry");

// Asad's own test purchases — record nothing for these (no DB row, no CAPI, no Slack).
// They are real Stripe charges but not customers; firing CAPI would pollute ad attribution.
const SELF_EMAILS = new Set(["asadshah.co.uk@gmail.com", "asad@huddleduck.co.uk"]);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const sha256 = (v) => createHash("sha256").update(String(v).trim().toLowerCase()).digest("hex");

async function fireCapi({ eventId, email, phone, name, value, sourceUrl }) {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !accessToken) {
    console.warn("  [capi] not configured (NEXT_PUBLIC_META_PIXEL_ID / META_CAPI_ACCESS_TOKEN) — skipping");
    return;
  }
  const user_data = {};
  if (email) user_data.em = sha256(email);
  if (phone) user_data.ph = sha256(phone);
  if (name) user_data.fn = sha256(name);
  const event = {
    event_name: "Purchase",
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: "website",
    event_source_url: sourceUrl,
    user_data,
    custom_data: { value, currency: "GBP" },
  };
  const res = await fetch(
    `https://graph.facebook.com/v25.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: [event] }) },
  );
  console.log(`  [capi] ${res.status} ${res.ok ? "ok" : (await res.text()).slice(0, 200)}`);
}

async function notifySlack(text) {
  const url = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url) return console.warn("  [slack] SLACK_WEBHOOK_URL not set — skipping");
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  console.log("  [slack] sent");
}

async function main() {
  // Pull all completed audit checkout sessions from Stripe (covers both tiers).
  const sessions = [];
  for await (const s of stripe.checkout.sessions.list({ limit: 100 })) {
    if (s.payment_status !== "paid") continue;
    const product = (s.metadata?.product ?? "").trim();
    if (product !== "audit-27" && product !== "audit-97") continue;
    sessions.push(s);
  }
  console.log(`Found ${sessions.length} paid audit checkout session(s) in Stripe.${DRY ? " (dry run)" : ""}\n`);

  for (const s of sessions) {
    const product = s.metadata.product.trim();
    const email = (s.metadata?.email ?? s.customer_details?.email ?? "").trim().toLowerCase();
    const name = (s.metadata?.name ?? s.customer_details?.name ?? "").trim();
    const ig = (s.metadata?.instagram_handle ?? "").trim();
    const piId = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
    const customerId = typeof s.customer === "string" ? s.customer : s.customer?.id ?? null;
    const amount = s.amount_total ?? 0;
    const currency = (s.currency ?? "gbp").toLowerCase();
    const parentSessionId = (s.metadata?.parent_session_id ?? "").trim() || null;

    console.log(`• ${product} £${(amount / 100).toFixed(2)} — ${email || "unknown"} (${s.id})`);

    if (SELF_EMAILS.has(email)) {
      console.log("  self/test purchase — skipping (no DB / CAPI / Slack)\n");
      continue;
    }

    // already recorded?
    const existing = await db.execute({
      sql: "SELECT id FROM audit_purchases WHERE stripe_session_id = ? LIMIT 1",
      args: [s.id],
    });
    if (existing.rows[0]) {
      console.log("  already in audit_purchases — skipping\n");
      continue;
    }

    // pull phone from waitlist if present
    let phone = s.customer_details?.phone ?? null;
    if (email) {
      const wl = await db.execute({ sql: "SELECT phone FROM waitlist WHERE email = ? LIMIT 1", args: [email] });
      if (wl.rows[0]?.phone) phone = wl.rows[0].phone;
    }

    if (DRY) {
      console.log("  would insert + fire CAPI + Slack\n");
      continue;
    }

    await db.execute({
      sql: `INSERT INTO audit_purchases
              (stripe_session_id, stripe_payment_intent_id, stripe_customer_id,
               email, name, phone, instagram_handle, tier, amount_total, currency,
               parent_session_id, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'backfill')
            ON CONFLICT(stripe_session_id) DO NOTHING`,
      args: [s.id, piId, customerId, email, name || null, phone, ig || null, product, amount, currency, parentSessionId],
    });
    console.log("  inserted into audit_purchases");

    if (email) {
      await fireCapi({
        eventId: s.id,
        email,
        phone,
        name: name || undefined,
        value: amount / 100,
        sourceUrl: "https://www.superpulse.io/waitlist/upsell",
      });
    }

    const label = product === "audit-97" ? "£97 Loom upsell" : "£27 audit";
    await notifySlack(
      `💷 ${label} purchased (£${(amount / 100).toFixed(2)}) — backfilled\n*Email:* ${email || "unknown"}` +
        (name ? `\n*Name:* ${name}` : "") +
        (ig ? `\n*Instagram:* @${ig}` : ""),
    );
    console.log("");
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
