import { createClient, type Client } from "@libsql/client";
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
      return (value as Function).bind(client);
    }
    return value;
  },
});

/**
 * Reads schema.sql and executes each CREATE TABLE IF NOT EXISTS statement.
 * Idempotent — safe to call on every startup.
 */
export async function runSchema(): Promise<void> {
  const schemaPath = join(process.cwd(), "src", "lib", "schema.sql");
  const sql = readFileSync(schemaPath, "utf-8");

  // Split on semicolons, filter out empty statements
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await db.execute(statement);
  }
}
