// Backfill the email sequence for waitlist members who joined before the
// sequence existed. Inserts an email_sequence_state row (position -1) for each,
// staggering anchor_at across a few days so the welcome + every later weekly
// send stays well under Resend's 100/day cap. The daily cron then sends each
// person their welcome (step 0) when due, and the rest follows automatically.
//
// The 3 existing £27 buyers need no special handling: the cron's send-time
// branch detects them and sends the post-audit variant of the audit email.
//
// Usage (from superpulse/):
//   node --env-file=.env.local scripts/backfill-email-sequence.mjs          # dry run (default)
//   node --env-file=.env.local scripts/backfill-email-sequence.mjs --live   # actually insert
//
// Idempotent: skips anyone already in email_sequence_state or email_unsubscribes.

import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

const LIVE = process.argv.includes("--live");
const STAGGER_DAYS = 5;

// Asad's own emails — never enrol his test addresses.
const SELF_EMAILS = new Set(["asadshah.co.uk@gmail.com", "asad@huddleduck.co.uk", "22ventnor@gmail.com"]);

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

function parseEnv(path) {
  try {
    const out = {};
    for (const line of readFileSync(path, "utf-8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
    return out;
  } catch {
    return null;
  }
}

async function duckOverlap(emails) {
  const env = parseEnv(join(HERE, "..", "..", "duck-emails", ".env.local"));
  if (!env?.TURSO_DATABASE_URL) return null;
  try {
    const duck = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
    const r = await duck.execute(`SELECT email FROM drip_contact_state`);
    const inDrip = new Set(r.rows.map((x) => String(x.email).toLowerCase()));
    return emails.filter((e) => inDrip.has(e));
  } catch (err) {
    console.warn("  [duck overlap] check failed:", err.message);
    return null;
  }
}

async function main() {
  console.log(`\nMode: ${LIVE ? "LIVE (will insert)" : "DRY RUN (no writes) — pass --live to insert"}\n`);

  const wl = await db.execute(
    `SELECT email, created_at FROM waitlist WHERE source != 'healthcheck' ORDER BY created_at ASC`,
  );
  const already = new Set(
    (await db.execute(`SELECT email FROM email_sequence_state`)).rows.map((r) => String(r.email).toLowerCase()),
  );
  const unsub = new Set(
    (await db.execute(`SELECT email FROM email_unsubscribes`)).rows.map((r) => String(r.email).toLowerCase()),
  );

  const candidates = [];
  let skipped = 0;
  for (const row of wl.rows) {
    const email = String(row.email).toLowerCase();
    if (SELF_EMAILS.has(email) || already.has(email) || unsub.has(email)) {
      skipped++;
      continue;
    }
    candidates.push(email);
  }

  // Who's already bought the audit (they'll get the post-audit variant at step 1).
  const buyers = new Set(
    (await db.execute(`SELECT DISTINCT email FROM audit_purchases WHERE tier = 'audit-27'`)).rows.map((r) =>
      String(r.email).toLowerCase(),
    ),
  );

  const nowMs = Date.now();
  const perDay = {};
  const plan = candidates.map((email, i) => {
    const dayOffset = i % STAGGER_DAYS;
    const anchor = new Date(nowMs + dayOffset * 86_400_000).toISOString();
    perDay[dayOffset] = (perDay[dayOffset] || 0) + 1;
    return { email, anchor, bought: buyers.has(email) };
  });

  console.log(`Waitlist (non-healthcheck): ${wl.rows.length}`);
  console.log(`Skipped (self / already enrolled / unsubscribed): ${skipped}`);
  console.log(`To enrol: ${plan.length}`);
  console.log(`Of those, already bought £27 audit (post-audit variant): ${plan.filter((p) => p.bought).length}`);
  console.log(`\nWelcome send spread (day offset from now -> count):`);
  for (let d = 0; d < STAGGER_DAYS; d++) console.log(`  +${d}d: ${perDay[d] || 0}`);

  const overlap = await duckOverlap(candidates);
  if (overlap) {
    console.log(`\nAlso in the Huddle Duck duck-emails drip: ${overlap.length}`);
    if (overlap.length) {
      console.log(`  ${overlap.join(", ")}`);
      console.log(`  (Consider suppressing these from the HD drip so nobody gets both.)`);
    }
  }

  if (!LIVE) {
    console.log(`\nDry run complete. Re-run with --live to insert ${plan.length} rows.\n`);
    return;
  }

  let inserted = 0;
  for (const p of plan) {
    await db.execute({
      sql: `INSERT INTO email_sequence_state (email, anchor_at, position, status) VALUES (?, ?, -1, 'active')
            ON CONFLICT(email) DO NOTHING`,
      args: [p.email, p.anchor],
    });
    inserted++;
  }
  console.log(`\nInserted ${inserted} rows. The cron will send welcomes once EMAIL_SEQUENCE_ENABLED=1.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
