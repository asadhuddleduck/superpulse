/**
 * v8 soak bootstrap. Creates ONE Meta campaign on act_1059094086326037 in
 * PAUSED state, then per-location creates ONE adset (£1/day, PAUSED) plus
 * one creative + one ad per soak reel. Mirrors all Meta IDs into
 * tenant_campaigns, location_adsets, reel_ads. Idempotent on the DB; on
 * Meta only when --reuse-campaign-id=<id> is passed.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/v8-soak-bootstrap.ts
 *   node --env-file=.env.local --import tsx scripts/v8-soak-bootstrap.ts --reuse-campaign-id=120243609000000000
 *
 * Tenant defaults to t_fb_3426122537565919 (Asad's IG on act_1059094086326037).
 * Override via TENANT_ID env var. Tenant MUST have ≥2 locations (3× spread
 * guardrail needs ≥2 adsets to do anything).
 *
 * The script depends on the patched lib/facebook.ts opt-out hunks
 * (multi-advertiser, advantage_audience, 17-key creative_features_spec).
 * Don't run until those land in the same branch.
 */

import { runSchema } from "@/lib/db";
import { getTenantById } from "@/lib/queries/tenants";
import { getLocationsForTenant } from "@/lib/queries/locations";
import { getPostsByTenant } from "@/lib/queries/posts";
import {
  createCampaign,
  createAdSet,
  createAdCreative,
  createAd,
} from "@/lib/facebook";
import {
  upsertTenantCampaign,
  upsertLocationAdset,
  upsertReelAd,
  getTenantCampaign,
  getLocationAdsets,
} from "@/lib/queries/v8";

const TENANT_ID = process.env.TENANT_ID ?? "t_fb_3426122537565919";
const SOAK_DAILY_BUDGET_PENNIES = 100; // £1/day per adset
const MAX_REELS = 2;

function parseReuseCampaign(): string | null {
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--reuse-campaign-id=(.+)$/);
    if (m) return m[1];
  }
  return null;
}

async function main() {
  console.log(`[v8-soak] tenant=${TENANT_ID}`);
  await runSchema();
  console.log("[v8-soak] schema migrated");

  const tenant = await getTenantById(TENANT_ID);
  if (!tenant) throw new Error(`tenant ${TENANT_ID} not found`);
  if (!tenant.metaAccessToken) throw new Error("tenant missing meta_access_token");
  if (!tenant.adAccountId) throw new Error("tenant missing ad_account_id");
  if (!tenant.pageId) throw new Error("tenant missing page_id");
  if (!tenant.igUserId) throw new Error("tenant missing ig_user_id");
  if (!tenant.igUsername) throw new Error("tenant missing ig_username");

  const cleanAdAccountId = tenant.adAccountId.startsWith("act_")
    ? tenant.adAccountId.slice(4)
    : tenant.adAccountId;
  const token = tenant.metaAccessToken;

  const locations = await getLocationsForTenant(TENANT_ID);
  if (locations.length < 2) throw new Error(`need ≥2 locations, got ${locations.length}`);
  console.log(`[v8-soak] ${locations.length} locations`);

  const allPosts = await getPostsByTenant(TENANT_ID);
  const reels = allPosts.filter((p) => p.mediaType === "VIDEO").slice(0, MAX_REELS);
  if (reels.length === 0) throw new Error("no VIDEO posts in DB for soak");
  console.log(`[v8-soak] using ${reels.length} reels`);

  // 1. Campaign — reuse or create.
  const reuseId = parseReuseCampaign();
  let metaCampaignId: string;
  if (reuseId) {
    metaCampaignId = reuseId;
    console.log(`[v8-soak] reusing campaign ${metaCampaignId}`);
  } else {
    const camp = await createCampaign(cleanAdAccountId, `SuperPulse v8 soak | ${TENANT_ID}`, token);
    metaCampaignId = camp.id;
    console.log(`[v8-soak] created campaign ${metaCampaignId}`);
  }
  await upsertTenantCampaign({
    tenantId: TENANT_ID,
    metaCampaignId,
    status: "PAUSED",
    dailyBudgetPennies: SOAK_DAILY_BUDGET_PENNIES * locations.length,
  });
  const tenantCampaign = await getTenantCampaign(TENANT_ID);
  if (!tenantCampaign) throw new Error("failed to upsert tenant_campaign");

  const existingAdsets = await getLocationAdsets(tenantCampaign.id);
  const adsetByLocation = new Map(existingAdsets.map((a) => [a.locationId, a]));

  // 2. Per-location adset + per-reel ad.
  for (const location of locations) {
    let metaAdsetId: string;
    const existing = adsetByLocation.get(location.id);
    if (existing) {
      metaAdsetId = existing.metaAdsetId;
      console.log(`[v8-soak] reusing adset ${metaAdsetId} for ${location.name}`);
    } else {
      const adset = await createAdSet(
        metaCampaignId,
        cleanAdAccountId,
        `SuperPulse v8 soak | ${location.name}`,
        SOAK_DAILY_BUDGET_PENNIES / 100,
        location.radiusMiles,
        location.latitude,
        location.longitude,
        tenant.pageId,
        token,
      );
      metaAdsetId = adset.id;
      console.log(`[v8-soak] created adset ${metaAdsetId} for ${location.name}`);
    }
    await upsertLocationAdset({
      tenantCampaignId: tenantCampaign.id,
      locationId: location.id,
      metaAdsetId,
      status: "PAUSED",
      dailyBudgetPennies: SOAK_DAILY_BUDGET_PENNIES,
    });
    const refreshedAdsets = await getLocationAdsets(tenantCampaign.id);
    const adsetRow = refreshedAdsets.find((a) => a.locationId === location.id);
    if (!adsetRow) throw new Error(`adset row missing after upsert for ${location.id}`);

    for (const reel of reels) {
      const creative = await createAdCreative(
        cleanAdAccountId,
        `SuperPulse v8 soak | ${location.name} | ${reel.id}`,
        reel.id,
        tenant.igUserId,
        tenant.igUsername,
        tenant.pageId,
        token,
      );
      const ad = await createAd(
        adsetRow.metaAdsetId,
        cleanAdAccountId,
        `SuperPulse v8 soak | ${location.name} | ${reel.id} · ad`,
        creative.id,
        token,
      );
      await upsertReelAd({
        locationAdsetId: adsetRow.id,
        postId: reel.id,
        metaAdId: ad.id,
        metaCreativeId: creative.id,
        status: "PAUSED",
      });
      console.log(`[v8-soak]   ad ${ad.id} (creative ${creative.id})`);
    }
  }

  console.log(`\n[v8-soak] DONE`);
  console.log(`  campaign ${metaCampaignId}`);
  console.log(`  ${locations.length} adsets, ${locations.length * reels.length} ads, all PAUSED`);
  console.log(`\nTo tear down (£0 spend allowed under ≥1p preserve-rule):`);
  console.log(`  curl -X DELETE "https://graph.facebook.com/v25.0/${metaCampaignId}?access_token=$META_ACCESS_TOKEN"`);
}

main().catch((err) => {
  console.error("[v8-soak] failed:", err);
  process.exit(1);
});
