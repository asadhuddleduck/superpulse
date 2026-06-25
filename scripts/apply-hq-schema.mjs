// Apply the full canonical schema (src/lib/schema.sql) to the live Turso DB,
// which now includes the Agency HQ tables. Idempotent — swallows
// "duplicate column" / "already exists" like runSchema() does.
// Run: node --env-file=.env.local scripts/apply-hq-schema.mjs
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "src", "lib", "schema.sql"), "utf-8");

// Strip `--` line comments outside string literals (mirror of runSchema()).
const stripped = sql
  .split("\n")
  .map((line) => {
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < line.length - 1; i++) {
      const c = line[i];
      if (c === "'" && !inDouble) inSingle = !inSingle;
      else if (c === '"' && !inSingle) inDouble = !inDouble;
      else if (c === "-" && line[i + 1] === "-" && !inSingle && !inDouble) return line.slice(0, i);
    }
    return line;
  })
  .join("\n");

const statements = stripped
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

const IDEMPOTENT = [/duplicate column name/i, /already exists/i];

async function main() {
  let ok = 0;
  for (const stmt of statements) {
    try {
      await db.execute(stmt);
      ok++;
    } catch (err) {
      if (!IDEMPOTENT.some((rx) => rx.test(err.message))) {
        console.error("FAILED:", stmt.slice(0, 80));
        throw err;
      }
    }
  }
  const t = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'hq_%' OR name='signup_links' ORDER BY name",
  );
  console.log(`Applied ${ok}/${statements.length} statements.`);
  console.log("HQ tables now:", t.rows.map((r) => r.name).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
