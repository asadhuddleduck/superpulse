// Apply just the email-sequence tables to the live Turso DB.
// Idempotent. Run: node --env-file=.env.local scripts/apply-email-schema.mjs
import { createClient } from "@libsql/client";

const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const stmts = [
  `CREATE TABLE IF NOT EXISTS email_sequence_state (
    email TEXT PRIMARY KEY,
    anchor_at TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT -1,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS email_sends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    step INTEGER NOT NULL,
    variant TEXT,
    resend_id TEXT,
    status TEXT NOT NULL,
    error TEXT,
    sent_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_email_sends_email ON email_sends(email, step)`,
  `CREATE TABLE IF NOT EXISTS email_unsubscribes (
    email TEXT PRIMARY KEY,
    reason TEXT,
    unsubscribed_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

async function main() {
  for (const s of stmts) await db.execute(s);
  const t = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'email_%' ORDER BY name",
  );
  console.log("email tables now:", t.rows.map((r) => r.name).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
