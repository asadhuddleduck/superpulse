import { createClient, type Client } from "@libsql/client/web";
import { readFileSync } from "fs";
import { join } from "path";

let _db: Client | null = null;

export function getDb(): Client {
  if (!_db) {
    const url = process.env.TURSO_DATABASE_URL?.trim();
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
    if (!url) throw new Error("TURSO_DATABASE_URL is not set");
    if (!authToken) throw new Error("TURSO_AUTH_TOKEN is not set");
    _db = createClient({ url, authToken });
  }
  return _db;
}

// Lazy proxy — defers client creation until first method call.
// Binds methods so private members (like #promiseLimitFunction) work correctly.
export const db = new Proxy({} as Client, {
  get(_target, prop) {
    const client = getDb();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});

// Errors libSQL throws when re-running idempotent ALTER TABLE / CREATE INDEX statements.
// We swallow these so the schema file can be re-applied on every cold start.
const IDEMPOTENT_ERROR_PATTERNS = [
  /duplicate column name/i,
  /already exists/i,
];

function isIdempotentError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return IDEMPOTENT_ERROR_PATTERNS.some((rx) => rx.test(msg));
}

/**
 * Reads schema.sql and executes each statement. Idempotent — safe to call on
 * every startup. Swallows "duplicate column" / "already exists" errors so the
 * inline ALTER TABLE migrations don't fail on re-runs.
 */
export async function runSchema(): Promise<void> {
  const schemaPath = join(process.cwd(), "src", "lib", "schema.sql");
  const sql = readFileSync(schemaPath, "utf-8");

  // Strip `-- ...` line comments BEFORE splitting on `;`. A bare split on `;`
  // mis-parses any semicolon that happens to live inside a comment (which
  // bit us once already — see commit fb6896f). Stripping comments first
  // means future schema authors can write whatever they want in `--` lines.
  const stripped = sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");

  const statements = stripped
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      await db.execute(statement);
    } catch (err) {
      if (!isIdempotentError(err)) throw err;
    }
  }
}
