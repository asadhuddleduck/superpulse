// Apply the demo-branch columns to the live Turso DB.
// Idempotent (ALTERs are try/caught on duplicate column).
// Run: node --env-file=.env.local scripts/apply-demo-schema.mjs
import { createClient } from "@libsql/client";

const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const stmts = [
  `ALTER TABLE qualifier_responses ADD COLUMN demo_qualified INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE qualifier_responses ADD COLUMN demo_offer_choice TEXT`,
  `ALTER TABLE qualifier_responses ADD COLUMN demo_requested_at TEXT`,
];

async function main() {
  for (const s of stmts) {
    try {
      await db.execute(s);
      console.log("applied:", s.slice(0, 70));
    } catch (err) {
      if (/duplicate column name/i.test(String(err))) console.log("exists: ", s.slice(0, 70));
      else throw err;
    }
  }
  const info = await db.execute(`SELECT name FROM pragma_table_info('qualifier_responses')`);
  console.log("columns:", info.rows.map((r) => r.name).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
