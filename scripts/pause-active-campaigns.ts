import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { decryptIfNeeded } from "../src/lib/crypto";
import { updateNodeStatus } from "../src/lib/facebook";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const APPLY = process.argv.includes("--apply");
const EXPECTED_ACTIVE_COUNT = 8;
const EXPECTED_AD_ACCOUNT = "1059094086326037";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const runStart = new Date().toISOString();
  console.log(`Run start: ${runStart}  mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);

  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const rows = (
    await db.execute({
      sql: `SELECT id, tenant_id, ad_account_id, meta_campaign_id, meta_adset_id, meta_ad_id, daily_budget, created_at
            FROM active_campaigns
            WHERE status = 'ACTIVE'
            ORDER BY created_at ASC`,
    })
  ).rows as any[];

  console.log(`\nFound ${rows.length} ACTIVE campaigns in DB`);
  if (rows.length === 0) {
    console.log("Nothing to pause. Done.");
    return;
  }
  if (rows.length !== EXPECTED_ACTIVE_COUNT) {
    console.error(`ABORT: expected ${EXPECTED_ACTIVE_COUNT} ACTIVE rows, got ${rows.length}. Re-check before running.`);
    process.exit(1);
  }
  for (const r of rows) {
    if (r.ad_account_id !== EXPECTED_AD_ACCOUNT) {
      console.error(`ABORT: row ${r.id} on unexpected ad_account_id=${r.ad_account_id}`);
      process.exit(1);
    }
  }

  const tokenRows = (
    await db.execute({
      sql: "SELECT id, meta_access_token FROM tenants WHERE id = ?",
      args: [rows[0].tenant_id],
    })
  ).rows as any[];
  const token = decryptIfNeeded(tokenRows[0].meta_access_token)!;

  // Snapshot pre-pause spend + status
  console.log("\nPre-pause snapshot (lifetime spend per campaign):");
  const preSnapshot: any[] = [];
  for (const r of rows) {
    const cid = r.meta_campaign_id;
    const c = await (
      await fetch(`https://graph.facebook.com/v25.0/${cid}?fields=name,status,effective_status&access_token=${token}`)
    ).json();
    const ins = await (
      await fetch(`https://graph.facebook.com/v25.0/${cid}/insights?fields=spend,impressions,clicks&date_preset=maximum&access_token=${token}`)
    ).json();
    const spend = ins.data?.[0]?.spend ?? "0";
    const imps = ins.data?.[0]?.impressions ?? "0";
    preSnapshot.push({ db_id: r.id, cid, name: c.name, eff: c.effective_status, spend, imps });
    console.log(`  db${r.id}  ${cid}  eff=${c.effective_status}  spend=£${spend}  imps=${imps}  name="${c.name}"`);
  }

  if (!APPLY) {
    console.log(`\n[DRY-RUN] Would pause ${rows.length} campaigns via three-layer updateNodeStatus(ad → adset → campaign).`);
    console.log("[DRY-RUN] Would write 8 boost_paused_admin audit rows + UPDATE active_campaigns.status='PAUSED' on each.");
    console.log("\nRun again with --apply to execute.");
    return;
  }

  // Phase: pause each, leaf-up
  let paused = 0;
  let failed = 0;
  const failures: any[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const cid = r.meta_campaign_id;
    const asid = r.meta_adset_id;
    const aid = r.meta_ad_id;

    try {
      // Leaf → root
      await updateNodeStatus(aid, "PAUSED", token);
      await updateNodeStatus(asid, "PAUSED", token);
      await updateNodeStatus(cid, "PAUSED", token);

      // Re-read to confirm
      const verify = await (
        await fetch(`https://graph.facebook.com/v25.0/${cid}?fields=status,effective_status&access_token=${token}`)
      ).json();

      if (verify.effective_status !== "PAUSED") {
        throw new Error(`Meta still reports effective_status=${verify.effective_status} after pause`);
      }

      // DB mirror
      await db.execute({
        sql: "UPDATE active_campaigns SET status = 'PAUSED' WHERE id = ?",
        args: [r.id],
      });

      // Audit row
      const snap = preSnapshot.find((p) => p.cid === cid);
      await db.execute({
        sql: `INSERT INTO audit_events (tenant_id, event_type, message, metadata)
              VALUES (?, 'boost_paused_admin', ?, ?)`,
        args: [
          r.tenant_id,
          `Paused by admin pre-process-rethink — ${snap?.name ?? cid}`,
          JSON.stringify({
            metaCampaignId: cid,
            metaAdsetId: asid,
            metaAdId: aid,
            lifetimeSpend: snap?.spend ?? null,
            lifetimeImpressions: snap?.imps ?? null,
            reason: "process-rethink",
            runStart,
          }),
        ],
      });

      paused++;
      console.log(`  [${i + 1}/${rows.length}] db${r.id} ${cid} -> PAUSED (verified)`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      failures.push({ db_id: r.id, cid, error: msg });
      console.error(`  [${i + 1}/${rows.length}] db${r.id} ${cid} -> FAILED: ${msg}`);
    }

    if (i < rows.length - 1) await sleep(250);
  }

  console.log(`\nTally: paused=${paused}  failed=${failed}  total=${rows.length}`);
  if (failures.length > 0) {
    console.error("\nFailures:");
    for (const f of failures) console.error(JSON.stringify(f));
    process.exit(1);
  }

  // Final DB sanity
  const remaining = await db.execute({ sql: "SELECT COUNT(*) AS n FROM active_campaigns WHERE status = 'ACTIVE'" });
  console.log(`\nDB ACTIVE count post-run: ${(remaining.rows[0] as any).n}  (expected 0)`);
  console.log(`Run start was ${runStart}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
