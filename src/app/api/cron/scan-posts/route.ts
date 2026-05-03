import { NextResponse } from "next/server";
import {
  fetchIGMedia,
  fetchIGUsername,
  createCampaign,
  createAdSet,
  createAdCreative,
  createAd,
  updateNodeStatus,
  deleteCampaign,
  checkBoostEligibility,
  getAdAccountStatus,
  type IGMediaItem,
} from "@/lib/facebook";
import { classifyMetaError } from "@/lib/meta-errors";
import { checkCronAuth } from "@/lib/cron-auth";
import { getActiveTenants, upsertTenant, type Tenant } from "@/lib/queries/tenants";
import {
  getLocationsForTenant,
  type Location,
} from "@/lib/queries/locations";
import {
  getCampaignsByTenant,
  upsertCampaign,
} from "@/lib/queries/campaigns";
import { getSettings } from "@/lib/queries/settings";
import {
  upsertPost,
  markPostIneligible,
  isPostIneligible,
} from "@/lib/queries/posts";
import { logApiCall, hasRecentFailureForPost } from "@/lib/queries/api-calls";
import { writeAuditEvent } from "@/lib/queries/audit-events";

interface ScoredPost {
  media: IGMediaItem;
  score: number;
}

/**
 * Cap on how many (post, location) boost flows a single tenant can run per
 * cron tick. Each flow is ~5 Meta API calls (campaign+adset+creative+ad+activate),
 * so 3 = ~15 calls/tenant/tick, keeping us safe under the 200 calls/hr/user budget
 * even with 5-tenant concurrency.
 */
const MAX_LOCATIONS_PER_TENANT_PER_TICK = 3;

/**
 * Inter-call delay between location boost flows to spread load on Meta. Tiny
 * but non-zero — looks more human than a hot loop hammering 5 calls in 200ms.
 */
const INTER_LOCATION_DELAY_MS = 500;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function scorePost(post: IGMediaItem): number {
  const likeCount = post.like_count ?? 0;
  const commentsCount = post.comments_count ?? 0;
  const engagement = (likeCount + commentsCount) / 1000;

  const ageHours =
    (Date.now() - new Date(post.timestamp).getTime()) / (1000 * 60 * 60);
  let recencyMultiplier: number;
  if (ageHours < 24) recencyMultiplier = 1.0;
  else if (ageHours < 48) recencyMultiplier = 0.8;
  else if (ageHours < 72) recencyMultiplier = 0.5;
  else recencyMultiplier = 0.2;

  let typeWeight: number;
  switch (post.media_type) {
    case "VIDEO": typeWeight = 1.5; break;
    case "CAROUSEL_ALBUM": typeWeight = 1.2; break;
    default: typeWeight = 1.0;
  }

  return engagement * recencyMultiplier * typeWeight;
}

function shortCaption(caption: string, fallback: string): string {
  const trimmed = caption.replace(/[^\w\s]/g, "").trim().split(/\s+/).slice(0, 5).join(" ");
  return trimmed || fallback;
}

interface TenantResult {
  tenantId: string;
  postsScanned: number;
  campaignsCreated: number;
  skippedIneligible: boolean;
  error?: string;
}

async function processTenant(tenant: Tenant): Promise<TenantResult> {
  const result: TenantResult = {
    tenantId: tenant.id,
    postsScanned: 0,
    campaignsCreated: 0,
    skippedIneligible: false,
  };

  const token = tenant.metaAccessToken;
  const igUserId = tenant.igUserId;
  const pageId = tenant.pageId;
  const adAccountId = tenant.adAccountId;

  if (!token || !igUserId || !pageId || !adAccountId) {
    result.error = "Tenant missing required Meta credentials";
    return result;
  }

  const settings = await getSettings(tenant.id);
  if (!settings.autoBoostEnabled) {
    result.error = "Auto-boost disabled for tenant";
    return result;
  }

  const cleanAdAccountId = adAccountId.startsWith("act_")
    ? adAccountId.slice(4)
    : adAccountId;

  // Runtime ad-account health check: skip the tenant if Meta no longer
  // reports the ad account as ACTIVE (status=1). Catches mid-flight closures,
  // disablements, billing settlements, risk reviews — all of which would
  // otherwise produce orphan campaign+adset pairs every 2h. One Graph call,
  // ~50ms, far cheaper than the 4-call orphan trail of a single failed boost.
  const accountHealth = await getAdAccountStatus(cleanAdAccountId, token);
  if (!accountHealth || accountHealth.accountStatus !== 1) {
    const detail = accountHealth
      ? `account_status=${accountHealth.accountStatus}, disable_reason=${accountHealth.disableReason}`
      : "fetch failed";
    result.error = `Ad account ${cleanAdAccountId} not spendable (${detail}); skipping tenant`;
    await writeAuditEvent(
      tenant.id,
      "error",
      `Skipped scan: ad account ${cleanAdAccountId} not spendable (${detail})`,
      { adAccountId: cleanAdAccountId, ...accountHealth },
    );
    return result;
  }

  // Fetch tenant's recent IG media. One call per tenant per cycle.
  const mediaStart = Date.now();
  let media: IGMediaItem[] = [];
  try {
    media = await fetchIGMedia(igUserId, token);
    await logApiCall({
      tenantId: tenant.id,
      endpoint: `/${igUserId}/media`,
      method: "GET",
      statusCode: 200,
      durationMs: Date.now() - mediaStart,
    });
  } catch (err) {
    await logApiCall({
      tenantId: tenant.id,
      endpoint: `/${igUserId}/media`,
      method: "GET",
      statusCode: 500,
      durationMs: Date.now() - mediaStart,
      error: err instanceof Error ? err.message : String(err),
    });
    result.error = `Failed to fetch IG media: ${err instanceof Error ? err.message : err}`;
    return result;
  }

  result.postsScanned = media.length;
  if (media.length === 0) return result;

  // Persist all media so the dashboard sees them and the eligibility flag sticks.
  for (const item of media) {
    await upsertPost(
      {
        id: item.id,
        mediaUrl: item.media_url ?? "",
        thumbnailUrl: item.thumbnail_url ?? "",
        caption: item.caption ?? "",
        timestamp: item.timestamp,
        likeCount: item.like_count ?? 0,
        commentsCount: item.comments_count ?? 0,
        mediaType: item.media_type as "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM",
        engagementRate: scorePost(item),
      },
      tenant.id,
    );
  }

  // De-dupe: any (post, location) pair already in active_campaigns is skipped.
  const existingCampaigns = await getCampaignsByTenant(tenant.id);
  const existingKeys = new Set(
    existingCampaigns.map((c) => `${c.postId}::${(c as { locationId?: number | null }).locationId ?? ""}`),
  );

  const locations: (Location | null)[] = await getLocationsForTenant(tenant.id);
  // If a tenant has no locations seeded, fall back to a single null-location run
  // using their boost_settings.target_radius_miles centred on... nothing usable
  // without coords, so we skip. Locations are required for the cron to act.
  if (locations.length === 0) {
    result.error = "Tenant has no locations seeded";
    return result;
  }

  // Pick the highest-scoring post that has at least one location not yet covered.
  const scored: ScoredPost[] = media
    .map((m) => ({ media: m, score: scorePost(m) }))
    .sort((a, b) => b.score - a.score);

  let igUsername = tenant.igUsername;
  if (!igUsername) {
    try {
      igUsername = await fetchIGUsername(igUserId, token);
      if (igUsername) {
        await upsertTenant({ id: tenant.id, igUsername });
      }
    } catch {
      result.error = "Failed to resolve IG username";
      return result;
    }
  }

  for (const scoredPost of scored) {
    const post = scoredPost.media;

    // Skip posts marked ineligible from a prior cycle (e.g. copyright music).
    if (await isPostIneligible(post.id)) continue;

    // 24h retry cooldown: if Meta 5xx'd this post in the last day, skip it.
    // Stops the 32-retry-on-dead-post pattern from the May 2026 incident.
    if (await hasRecentFailureForPost(tenant.id, post.id)) continue;

    const uncoveredLocations = locations.filter(
      (loc) => loc && !existingKeys.has(`${post.id}::${loc.id}`),
    ) as Location[];
    if (uncoveredLocations.length === 0) continue;

    // Single eligibility check per post (cached across all this post's locations).
    const eligibilityStart = Date.now();
    let eligibility: { eligible: boolean; reason?: string };
    try {
      eligibility = await checkBoostEligibility(post.id, token);
      await logApiCall({
        tenantId: tenant.id,
        endpoint: `/${post.id}?fields=boost_eligibility_info`,
        method: "GET",
        statusCode: 200,
        durationMs: Date.now() - eligibilityStart,
      });
    } catch (err) {
      await logApiCall({
        tenantId: tenant.id,
        endpoint: `/${post.id}?fields=boost_eligibility_info`,
        method: "GET",
        statusCode: 500,
        durationMs: Date.now() - eligibilityStart,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    if (!eligibility.eligible) {
      await markPostIneligible(post.id, eligibility.reason ?? "ineligible");
      result.skippedIneligible = true;
      continue;
    }

    const captionLabel = shortCaption(post.caption ?? "", post.id.slice(-6));

    let postRejected = false;
    // Velocity stagger: trim to MAX_LOCATIONS_PER_TENANT_PER_TICK and sleep
    // INTER_LOCATION_DELAY_MS between flows. Caps API burst per tenant.
    const cappedLocations = uncoveredLocations.slice(0, MAX_LOCATIONS_PER_TENANT_PER_TICK);

    for (let locIdx = 0; locIdx < cappedLocations.length; locIdx++) {
      const location = cappedLocations[locIdx];
      if (locIdx > 0) await sleep(INTER_LOCATION_DELAY_MS);
      // Hoisted so the catch block can clean up the orphan campaign if a
      // downstream step (createAdCreative / createAd) fails after
      // createCampaign already succeeded on Meta's side.
      let createdCampaignId: string | null = null;

      try {
        const campaignName = `SuperPulse v7 | ${location.name} | ${captionLabel}`;
        const campaignStart = Date.now();
        const campaign = await createCampaign(cleanAdAccountId, campaignName, token);
        createdCampaignId = campaign.id;
        await logApiCall({
          tenantId: tenant.id,
          endpoint: `/act_${cleanAdAccountId}/campaigns`,
          method: "POST",
          statusCode: 200,
          durationMs: Date.now() - campaignStart,
        });

        const adsetStart = Date.now();
        const adSet = await createAdSet(
          campaign.id,
          cleanAdAccountId,
          `${location.name} ${location.radiusMiles}mi · £${settings.dailyBudgetCap}/day`,
          settings.dailyBudgetCap,
          location.radiusMiles,
          location.latitude,
          location.longitude,
          pageId,
          token,
        );
        await logApiCall({
          tenantId: tenant.id,
          endpoint: `/act_${cleanAdAccountId}/adsets`,
          method: "POST",
          statusCode: 200,
          durationMs: Date.now() - adsetStart,
        });

        const creativeStart = Date.now();
        const creative = await createAdCreative(
          cleanAdAccountId,
          `${campaignName} · creative`,
          post.id,
          igUserId,
          igUsername,
          pageId,
          token,
        );
        await logApiCall({
          tenantId: tenant.id,
          endpoint: `/act_${cleanAdAccountId}/adcreatives`,
          method: "POST",
          statusCode: 200,
          durationMs: Date.now() - creativeStart,
        });

        const adStart = Date.now();
        const ad = await createAd(
          adSet.id,
          cleanAdAccountId,
          `${campaignName} · ad`,
          creative.id,
          token,
        );
        await logApiCall({
          tenantId: tenant.id,
          endpoint: `/act_${cleanAdAccountId}/ads`,
          method: "POST",
          statusCode: 200,
          durationMs: Date.now() - adStart,
        });

        // Activate ALL THREE layers — campaign, adset, ad. Activating just
        // the campaign leaves the adset+ad PAUSED (which is how they were
        // created by createAdSet/createAd) and the campaign delivers nothing.
        // 10 of 12 "live" campaigns on 2 May 2026 were zombies because of
        // this bug. Sequenced campaign → adset → ad because Meta validates
        // each level against its parent's status.
        const activateStart = Date.now();
        await updateNodeStatus(campaign.id, "ACTIVE", token);
        await updateNodeStatus(adSet.id, "ACTIVE", token);
        await updateNodeStatus(ad.id, "ACTIVE", token);
        await logApiCall({
          tenantId: tenant.id,
          endpoint: `/${campaign.id} (+adset+ad activate)`,
          method: "POST",
          statusCode: 200,
          durationMs: Date.now() - activateStart,
        });

        await upsertCampaign(
          {
            postId: post.id,
            adAccountId: cleanAdAccountId,
            metaCampaignId: campaign.id,
            metaAdsetId: adSet.id,
            metaAdId: ad.id,
            status: "ACTIVE",
            dailyBudget: settings.dailyBudgetCap,
            createdAt: new Date().toISOString(),
          },
          tenant.id,
          location.id,
        );

        existingKeys.add(`${post.id}::${location.id}`);
        result.campaignsCreated++;

        await writeAuditEvent(
          tenant.id,
          "boost_activated",
          `Boost live for "${captionLabel}" in ${location.name}`,
          { postId: post.id, locationId: location.id, metaCampaignId: campaign.id },
        );
        // Distinct from boost_activated (status flip): this fires only after
        // the full pipeline (campaign+adset+creative+ad+activate) lands clean.
        // Lets us alert on "no boost_succeeded in 24h despite >0 attempts".
        await writeAuditEvent(
          tenant.id,
          "boost_succeeded",
          `Full boost flow succeeded for "${captionLabel}" in ${location.name}`,
          { postId: post.id, locationId: location.id, metaCampaignId: campaign.id, metaAdId: ad.id },
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Permanent rejections get their own review_failed event below; this
        // covers transient failures and pre-classification errors so the
        // dashboard activity feed shows that we tried and failed.
        await writeAuditEvent(
          tenant.id,
          "boost_failed",
          `Boost flow failed for "${captionLabel}" in ${location.name}`,
          {
            postId: post.id,
            locationId: location.id,
            metaCampaignId: createdCampaignId,
            error: message.slice(0, 500),
          },
        );
        await logApiCall({
          tenantId: tenant.id,
          endpoint: `/act_${cleanAdAccountId}/* (boost flow)`,
          method: "POST",
          statusCode: 500,
          durationMs: 0,
          // `post:<id>` prefix is the stable key that hasRecentFailureForPost
          // grep against to enforce the 24h retry cooldown.
          error: `post:${post.id} ${message}`,
        });

        // Best-effort: delete the orphan campaign+adset that Meta created
        // before the failure point. Silent on failure — cleanup matters less
        // than not crashing the cron.
        if (createdCampaignId) {
          await deleteCampaign(createdCampaignId, token, tenant.id);
        }

        // If Meta rejected this post for a permanent product-policy reason
        // (e.g. copyright music), mark it ineligible so we don't retry it
        // every 2h cron tick. Break out of the per-location loop too — the
        // same post will fail in every location.
        const rejection = classifyMetaError(err);
        if (rejection?.permanent) {
          await markPostIneligible(post.id, rejection.reason);
          await writeAuditEvent(
            tenant.id,
            "review_failed",
            `Post "${captionLabel}" marked ineligible: ${rejection.reason}`,
            { postId: post.id, reason: rejection.reason },
          );
          postRejected = true;
          break;
        }
        // Otherwise it's a transient error — move to the next location.
      }
    }

    // If the post hit a permanent rejection, try the next-highest-scoring
    // post in this cron tick instead of stopping entirely.
    if (postRejected) continue;

    // Boost one successful post per cron tick to keep call volume predictable.
    break;
  }

  await writeAuditEvent(
    tenant.id,
    "scan_completed",
    result.campaignsCreated > 0
      ? `Scanned ${result.postsScanned} posts, created ${result.campaignsCreated} boost(s)`
      : `Scanned ${result.postsScanned} posts`,
    { campaignsCreated: result.campaignsCreated, skippedIneligible: result.skippedIneligible },
  );

  return result;
}

// Cap parallel tenant work so a 100-tenant fleet can't blow Meta's per-app rate
// limits in a single tick. 5 keeps us well under the 200 calls/hr per-user budget.
const TENANT_CONCURRENCY = 5;

async function runScan() {
  const tenants = await getActiveTenants();
  const results: TenantResult[] = new Array(tenants.length);

  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= tenants.length) return;
      const tenant = tenants[i];
      try {
        results[i] = await processTenant(tenant);
      } catch (err) {
        results[i] = {
          tenantId: tenant.id,
          postsScanned: 0,
          campaignsCreated: 0,
          skippedIneligible: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(TENANT_CONCURRENCY, tenants.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return {
    tenantsProcessed: tenants.length,
    totalCampaignsCreated: results.reduce((sum, r) => sum + r.campaignsCreated, 0),
    results,
  };
}

export async function GET(request: Request) {
  // Kill switch: SuperPulse process redesign in progress (see INCIDENT-LOG 2026-05-03).
  // Default behaviour (env unset OR not "off") = handler returns immediately, creates nothing.
  // Set SCAN_POSTS_KILL_SWITCH=off in Vercel ONLY when the new boost flow is approved + shipped.
  // This guard exists so even an accidental re-add of /api/cron/scan-posts to vercel.json
  // cannot create campaigns. Remove this block when re-enabling, not before.
  if (process.env.SCAN_POSTS_KILL_SWITCH !== "off") {
    return NextResponse.json(
      {
        ok: false,
        skipped: true,
        reason: "scan-posts disabled pending process rethink — see INCIDENT-LOG 2026-05-03",
      },
      { status: 200 },
    );
  }

  const authError = checkCronAuth(request);
  if (authError) return authError;
  try {
    const summary = await runScan();
    return NextResponse.json(summary);
  } catch (err) {
    console.error("scan-posts cron error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// Allow POST too so manual triggers (e.g. an "Asad runs it now" button) work.
export const POST = GET;
