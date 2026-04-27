// One-shot migration: encrypt any plaintext meta_access_token in tenants.
// Idempotent — re-running is a no-op once all rows are encrypted.
//   node --env-file=.env.local --import tsx scripts/encrypt-tenant-tokens.ts

import { db } from "../src/lib/db";
import { ensureEncrypted, isEncrypted } from "../src/lib/crypto";

async function main() {
  const result = await db.execute({
    sql: `SELECT id, meta_access_token FROM tenants WHERE meta_access_token IS NOT NULL`,
    args: [],
  });

  let migrated = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const row of result.rows) {
    const id = row.id as string;
    const token = row.meta_access_token as string;
    if (isEncrypted(token)) {
      skipped++;
      continue;
    }
    const encrypted = ensureEncrypted(token)!;
    await db.execute({
      sql: `UPDATE tenants SET meta_access_token = ?, updated_at = ? WHERE id = ?`,
      args: [encrypted, now, id],
    });
    console.log(`encrypted: ${id}`);
    migrated++;
  }

  console.log(`\nDone. migrated=${migrated} skipped=${skipped} total=${result.rows.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
