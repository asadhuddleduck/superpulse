import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { decryptIfNeeded } from "../src/lib/crypto";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

async function main() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const t = await db.execute({
    sql: "SELECT meta_access_token FROM tenants WHERE id = ?",
    args: ["t_fb_3426122537565919"],
  });
  const token = decryptIfNeeded(t.rows[0].meta_access_token as string)!;

  const acRes = await db.execute({
    sql: `SELECT id, meta_campaign_id, meta_adset_id, meta_ad_id, status, daily_budget, created_at
          FROM active_campaigns
          WHERE created_at >= '2026-05-02 10:00:00'
          ORDER BY created_at ASC`,
  });

  const summary: any[] = [];
  for (const r of acRes.rows) {
    const cid = r.meta_campaign_id as string;
    const asid = r.meta_adset_id as string;
    const aid = r.meta_ad_id as string;

    const campF = "id,name,status,effective_status,configured_status,created_time,start_time,stop_time,issues_info,daily_budget";
    const adsetF = "id,status,effective_status,configured_status,daily_budget,issues_info";
    const adF = "id,status,effective_status,configured_status,issues_info,ad_review_feedback";

    const camp = await (await fetch(`https://graph.facebook.com/v25.0/${cid}?fields=${campF}&access_token=${token}`)).json();
    const adset = await (await fetch(`https://graph.facebook.com/v25.0/${asid}?fields=${adsetF}&access_token=${token}`)).json();
    const ad = await (await fetch(`https://graph.facebook.com/v25.0/${aid}?fields=${adF}&access_token=${token}`)).json();
    const ins = await (await fetch(`https://graph.facebook.com/v25.0/${cid}/insights?fields=spend,impressions,reach,clicks&date_preset=maximum&access_token=${token}`)).json();

    summary.push({
      db_id: r.id,
      created_at: r.created_at,
      campaign_id: cid,
      camp_status: camp.status,
      camp_eff: camp.effective_status,
      adset_status: adset.status,
      adset_eff: adset.effective_status,
      ad_status: ad.status,
      ad_eff: ad.effective_status,
      ad_review: ad.ad_review_feedback,
      issues_camp: camp.issues_info,
      issues_adset: adset.issues_info,
      issues_ad: ad.issues_info,
      insights: ins.data?.[0] ?? null,
      insights_err: ins.error ?? null,
    });
  }

  console.log("=== NEW CAMPAIGN HEALTH (since 2026-05-02 10:00 UTC) ===");
  console.log(JSON.stringify(summary, null, 2));

  const orphansRes = await (
    await fetch(
      `https://graph.facebook.com/v25.0/act_1059094086326037/campaigns?fields=id,name,status,effective_status,created_time&limit=200&access_token=${token}`,
    )
  ).json();

  const allDb = await db.execute({ sql: "SELECT meta_campaign_id FROM active_campaigns" });
  const allDbIds = new Set(allDb.rows.map((r) => r.meta_campaign_id as string));

  const metaCamps: any[] = orphansRes.data || [];
  const orphansList = metaCamps.filter((c) => !allDbIds.has(c.id));

  console.log("\n=== ORPHAN ANALYSIS ===");
  console.log(`Total Meta campaigns on act_1059094086326037: ${metaCamps.length}`);
  console.log(`DB-tracked campaigns ever: ${allDbIds.size}`);
  console.log(`Orphans (Meta but not in DB): ${orphansList.length}`);
  const byStatus: Record<string, number> = {};
  for (const o of orphansList) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  console.log("Orphans by status:", byStatus);
  const newOrphans = orphansList.filter((o) => o.created_time >= "2026-05-02T10:00:00");
  console.log(`\nNEW orphans created since 2026-05-02 10:00 UTC: ${newOrphans.length}`);
  if (newOrphans.length) console.log(JSON.stringify(newOrphans, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
