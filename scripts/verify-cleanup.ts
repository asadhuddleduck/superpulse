import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { decryptIfNeeded } from "../src/lib/crypto";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

async function main() {
  const db = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN! });
  const t = await db.execute({ sql: "SELECT meta_access_token FROM tenants WHERE id = ?", args: ["t_fb_3426122537565919"] });
  const token = decryptIfNeeded(t.rows[0].meta_access_token as string)!;

  const r = await (await fetch(`https://graph.facebook.com/v25.0/act_1059094086326037/campaigns?fields=id,status&limit=200&access_token=${token}`)).json();
  const allDb = await db.execute({ sql: "SELECT meta_campaign_id FROM active_campaigns" });
  const dbIds = new Set(allDb.rows.map((r: any) => r.meta_campaign_id));
  const meta: any[] = r.data || [];
  const orphans = meta.filter((c) => !dbIds.has(c.id));
  console.log(`Meta total: ${meta.length}, DB-tracked: ${dbIds.size}, orphans: ${orphans.length}`);

  const probe = ["120243465680950448", "120243389367140448", "120243435479320448"];
  for (const cid of probe) {
    const j = await (await fetch(`https://graph.facebook.com/v25.0/${cid}?access_token=${token}`)).json();
    console.log(`  ${cid} -> ${JSON.stringify(j).slice(0, 220)}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
