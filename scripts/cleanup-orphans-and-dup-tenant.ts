import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { decryptIfNeeded } from "../src/lib/crypto";
import { deleteCampaign } from "../src/lib/facebook";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const APPLY = process.argv.includes("--apply");
const ACTIVE_TENANT_ID = "t_fb_3426122537565919";
const DUP_TENANT_ID = "t_17841400702538222";
const AD_ACCOUNT = "act_1059094086326037";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const runStart = new Date().toISOString();
  console.log(`Run start: ${runStart}  mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);

  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const t = await db.execute({
    sql: "SELECT meta_access_token FROM tenants WHERE id = ?",
    args: [ACTIVE_TENANT_ID],
  });
  if (t.rows.length === 0) throw new Error(`Active tenant ${ACTIVE_TENANT_ID} not found`);
  const token = decryptIfNeeded(t.rows[0].meta_access_token as string)!;

  // === PHASE A: orphan campaign cleanup =====================================
  console.log(`\n=== PHASE A: orphan campaigns on ${AD_ACCOUNT} ===`);

  const metaRes = await (
    await fetch(
      `https://graph.facebook.com/v25.0/${AD_ACCOUNT}/campaigns?fields=id,name,status,effective_status,created_time&limit=200&access_token=${token}`,
    )
  ).json();
  if (metaRes.error) throw new Error(`Meta list error: ${JSON.stringify(metaRes.error)}`);
  const metaCamps: any[] = metaRes.data || [];

  const allDb = await db.execute({ sql: "SELECT meta_campaign_id FROM active_campaigns" });
  const dbIds = new Set(allDb.rows.map((r) => r.meta_campaign_id as string));

  const orphans = metaCamps.filter((c) => !dbIds.has(c.id));
  const nonPaused = orphans.filter((o) => o.status !== "PAUSED");

  console.log(`Meta total: ${metaCamps.length}, DB-tracked: ${dbIds.size}, orphans: ${orphans.length}`);
  if (orphans.length === 0) {
    console.log("No orphans — Phase A skipped.");
  } else {
    if (nonPaused.length > 0) {
      console.error(`ABORT: ${nonPaused.length} orphan(s) are NOT PAUSED — refusing to delete:`);
      for (const c of nonPaused) console.error(`  ${c.id} status=${c.status} eff=${c.effective_status} created=${c.created_time}`);
      process.exit(1);
    }
    console.log("\nOrphans to delete:");
    for (const c of orphans) {
      console.log(`  ${c.id}  ${c.status}  ${c.created_time}  ${c.name ?? ""}`);
    }

    if (!APPLY) {
      console.log(`\n[DRY-RUN] Would call deleteCampaign() on ${orphans.length} campaigns.`);
    } else {
      let deleted = 0,
        failed = 0;
      for (let i = 0; i < orphans.length; i++) {
        const c = orphans[i];
        const ok = await deleteCampaign(c.id, token, ACTIVE_TENANT_ID);
        if (ok) deleted++;
        else failed++;
        process.stdout.write(`  [${i + 1}/${orphans.length}] ${c.id} -> ${ok ? "deleted" : "FAILED"}\n`);
        if (i < orphans.length - 1) await sleep(250);
      }
      console.log(`\nPhase A tally: deleted=${deleted}  failed=${failed}  total=${orphans.length}`);
    }
  }

  // === PHASE B: duplicate tenant deletion ===================================
  console.log(`\n=== PHASE B: duplicate tenant ${DUP_TENANT_ID} ===`);

  const tenantRow = await db.execute({
    sql: "SELECT id, status, ad_account_id, created_at FROM tenants WHERE id = ?",
    args: [DUP_TENANT_ID],
  });
  if (tenantRow.rows.length === 0) {
    console.log("Tenant already gone — Phase B skipped.");
  } else {
    const tr = tenantRow.rows[0] as any;
    console.log(`Tenant row: status=${tr.status}  ad_account_id=${tr.ad_account_id}  created=${tr.created_at}`);
    if (tr.ad_account_id) {
      console.error(`ABORT: duplicate tenant has ad_account_id=${tr.ad_account_id} — refusing to delete.`);
      process.exit(1);
    }

    const counts = await db.execute({
      sql: `SELECT
              (SELECT COUNT(*) FROM active_campaigns WHERE tenant_id = ?) AS active_campaigns,
              (SELECT COUNT(*) FROM ig_posts        WHERE tenant_id = ?) AS ig_posts,
              (SELECT COUNT(*) FROM locations       WHERE tenant_id = ?) AS locations,
              (SELECT COUNT(*) FROM audit_events    WHERE tenant_id = ?) AS audit_events,
              (SELECT COUNT(*) FROM api_call_log    WHERE tenant_id = ?) AS api_call_log,
              (SELECT COUNT(*) FROM boost_settings  WHERE tenant_id = ?) AS boost_settings`,
      args: Array(6).fill(DUP_TENANT_ID),
    });
    const c = counts.rows[0] as any;
    console.log("Residual row counts:", {
      active_campaigns: Number(c.active_campaigns),
      ig_posts: Number(c.ig_posts),
      locations: Number(c.locations),
      audit_events: Number(c.audit_events),
      api_call_log: Number(c.api_call_log),
      boost_settings: Number(c.boost_settings),
    });

    if (Number(c.active_campaigns) > 0) {
      console.error(`ABORT: duplicate tenant has ${c.active_campaigns} active_campaigns row(s) — refusing to delete.`);
      process.exit(1);
    }

    if (!APPLY) {
      console.log(`\n[DRY-RUN] Would DELETE rows for ${DUP_TENANT_ID} across all tables, then DELETE tenants row, then write tenant_deleted audit.`);
    } else {
      const igPostsDeleted = Number(c.ig_posts);
      const apiCallLogDeleted = Number(c.api_call_log);

      const tx = await db.transaction("write");
      try {
        await tx.execute({ sql: "DELETE FROM ig_posts WHERE tenant_id = ?", args: [DUP_TENANT_ID] });
        await tx.execute({ sql: "DELETE FROM api_call_log WHERE tenant_id = ?", args: [DUP_TENANT_ID] });
        await tx.execute({ sql: "DELETE FROM locations WHERE tenant_id = ?", args: [DUP_TENANT_ID] });
        await tx.execute({ sql: "DELETE FROM boost_settings WHERE tenant_id = ?", args: [DUP_TENANT_ID] });
        await tx.execute({ sql: "DELETE FROM audit_events WHERE tenant_id = ?", args: [DUP_TENANT_ID] });
        await tx.execute({ sql: "DELETE FROM active_campaigns WHERE tenant_id = ?", args: [DUP_TENANT_ID] });
        await tx.execute({ sql: "DELETE FROM tenants WHERE id = ?", args: [DUP_TENANT_ID] });
        await tx.commit();
      } catch (e) {
        await tx.rollback();
        throw e;
      }

      await db.execute({
        sql: `INSERT INTO audit_events (tenant_id, event_type, message, metadata)
              VALUES (?, 'tenant_deleted', ?, ?)`,
        args: [
          ACTIVE_TENANT_ID,
          `Duplicate tenant ${DUP_TENANT_ID} deleted (legacy IG-Login origin, orphan after picker re-bind)`,
          JSON.stringify({
            deletedTenantId: DUP_TENANT_ID,
            igPostsDeleted,
            apiCallLogDeleted,
            runStart,
          }),
        ],
      });

      console.log(`Phase B: deleted tenant ${DUP_TENANT_ID} (igPosts=${igPostsDeleted}, apiCallLog=${apiCallLogDeleted}). Audit row written.`);
    }
  }

  console.log(`\nDone. Run start was ${runStart} (use this in verification queries).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
