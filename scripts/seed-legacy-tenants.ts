/**
 * Pre-seed legacy clients into the tenants + locations tables so the OAuth
 * callback can match them by ig_user_id and land them straight on /dashboard
 * with NO picker UI.
 *
 * Usage (from superpulse/ root):
 *   npm run seed:legacy
 * (which is: node --env-file=.env.local --import tsx scripts/seed-legacy-tenants.ts)
 *
 * Refuses to run if any TODO_ placeholders remain in legacy-tenants.json.
 * Idempotent — re-running updates rows in place via the upsert + replace flow.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { upsertTenant } from "../src/lib/queries/tenants";
import { runSchema } from "../src/lib/db";

interface SeedTenant {
  id: string;
  name: string;
  ig_user_id: string;
  page_id: string;
  ad_account_id: string;
  ig_username: string;
}

interface SeedFile {
  _README?: string;
  tenants: SeedTenant[];
}

function hasPlaceholders(value: string): boolean {
  return value.startsWith("TODO_") || value.includes("TODO");
}

async function main() {
  const path = join(process.cwd(), "scripts", "legacy-tenants.json");
  const raw = readFileSync(path, "utf-8");
  const data = JSON.parse(raw) as SeedFile;

  for (const t of data.tenants) {
    const placeholderFields = [
      ["ig_user_id", t.ig_user_id],
      ["page_id", t.page_id],
      ["ad_account_id", t.ad_account_id],
      ["ig_username", t.ig_username],
    ].filter(([, v]) => hasPlaceholders(v));

    if (placeholderFields.length > 0) {
      console.error(
        `[seed] Refusing to seed ${t.name} — TODO_ placeholders in: ${placeholderFields
          .map(([k]) => k)
          .join(", ")}`,
      );
      continue;
    }

    await upsertTenant({
      id: t.id,
      name: t.name,
      igUserId: t.ig_user_id,
      pageId: t.page_id,
      adAccountId: t.ad_account_id,
      igUsername: t.ig_username,
      // status stays 'pending_oauth' until the owner actually logs in and the
      // OAuth callback writes the access token.
      status: "pending_oauth",
    });

    console.log(`[seed] ${t.name} → tenant row seeded (locations to be added by client via /dashboard/locations)`);
  }

  console.log("[seed] Done.");
}

(async () => {
  try {
    await runSchema();
    await main();
    process.exit(0);
  } catch (err) {
    console.error("[seed] Failed:", err);
    process.exit(1);
  }
})();
