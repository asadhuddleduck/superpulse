import { createClient, type Client } from "@libsql/client";

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
