// Apply the Cal.com booking columns + webhook idempotency table to the live
// Turso DB. Idempotent (ALTERs are try/caught on duplicate column).
// Run: node --env-file=.env.local scripts/apply-cal-schema.mjs
import { createClient } from "@libsql/client";

const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const alters = [
  `ALTER TABLE qualifier_responses ADD COLUMN demo_scheduled_at TEXT`,
  `ALTER TABLE qualifier_responses ADD COLUMN cal_booking_uid TEXT`,
  `ALTER TABLE qualifier_responses ADD COLUMN demo_booking_status TEXT`,
];

const tables = [
  // Every Cal webhook delivery is logged here keyed on (uid, trigger) so a
  // retried or duplicated delivery is processed exactly once. Mirrors the
  // audit_purchases idempotency pattern.
  `CREATE TABLE IF NOT EXISTS cal_webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cal_booking_uid TEXT NOT NULL,
    trigger_event TEXT NOT NULL,
    payload TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cal_booking_uid, trigger_event)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cal_webhook_uid ON cal_webhook_events(cal_booking_uid)`,
  `CREATE INDEX IF NOT EXISTS idx_qualifier_scheduled ON qualifier_responses(demo_scheduled_at)`,
];

async function main() {
  for (const s of alters) {
    try {
      await db.execute(s);
      console.log("applied:", s.slice(0, 70));
    } catch (err) {
      if (/duplicate column name/i.test(String(err))) console.log("exists: ", s.slice(0, 70));
      else throw err;
    }
  }
  for (const s of tables) {
    await db.execute(s);
    console.log("applied:", s.slice(0, 60).replace(/\s+/g, " "));
  }
  const info = await db.execute(`SELECT name FROM pragma_table_info('qualifier_responses')`);
  console.log("qualifier_responses columns:", info.rows.map((r) => r.name).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
