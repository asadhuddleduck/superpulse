import { NextRequest, NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/auth";
import {
  fetchIGUsername,
  createCampaign,
  createAdSet,
  createAdCreative,
  createAd,
  updateCampaignStatus,
  checkBoostEligibility,
} from "@/lib/facebook";
import { upsertTenant } from "@/lib/queries/tenants";
import { getLocationsForTenant } from "@/lib/queries/locations";
import { upsertCampaign, getCampaignsByTenant } from "@/lib/queries/campaigns";
import { isPostIneligible, markPostIneligible } from "@/lib/queries/posts";
import { logApiCall } from "@/lib/queries/api-calls";
import { writeAuditEvent } from "@/lib/queries/audit-events";

interface CreatedCampaign {
  locationId: number;
  locationName: string;
  campaignId: string;
  adSetId: string;
  adId: string;
  status: "ACTIVE";
}

export async function POST(request: NextRequest) {
  const tenant = await getCurrentTenant();
  if (!tenant || !tenant.metaAccessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = tenant.metaAccessToken;

  try {
    const body = await request.json();
    const { postId, caption = "", dailyBudget = 5 } = body;

    if (!postId) {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }

    if (!tenant.pageId || !tenant.igUserId || !tenant.adAccountId) {
      return NextResponse.json(
        { error: "Tenant is not fully connected. Re-run the onboarding flow to pick a Page." },
        { status: 412 },
      );
    }

    const shortCaption =
      caption.replace(/[^\w\s]/g, "").trim().split(/\s+/).slice(0, 5).join(" ") ||
      postId.slice(-6);

    // Cheap local check first — saves a Meta API call (and the resulting error
    // count against the App Review 15% threshold) for posts the cron has
    // already flagged ineligible.
    if (await isPostIneligible(postId)) {
      return NextResponse.json(
        { error: "This post was previously flagged as not boostable (e.g. copyright music). Re-upload without the issue and try again." },
        { status: 400 },
      );
    }

    const eligibility = await checkBoostEligibility(postId, token);
    if (!eligibility.eligible) {
      // Persist so the cron skips it next cycle too.
      await markPostIneligible(postId, eligibility.reason ?? "ineligible");
      return NextResponse.json(
        { error: `Post not eligible: ${eligibility.reason ?? "unknown"}` },
        { status: 400 },
      );
    }

    const locations = await getLocationsForTenant(tenant.id);
    if (locations.length === 0) {
      return NextResponse.json(
        {
          error:
            "Add at least one location in Settings before boosting. Each location targets its own area.",
        },
        { status: 412 },
      );
    }

    const pageId = tenant.pageId;
    const igUserId = tenant.igUserId;
    const cleanAdAccountId = tenant.adAccountId.startsWith("act_")
      ? tenant.adAccountId.slice(4)
      : tenant.adAccountId;

    let igUsername = tenant.igUsername;
    if (!igUsername) {
      igUsername = await fetchIGUsername(igUserId, token);
      if (igUsername) {
        await upsertTenant({ id: tenant.id, igUsername });
      }
    }

    // De-dupe against existing (post, location) pairs so re-clicking Boost is
    // idempotent — same contract the cron honours via the same lookup.
    const existingCampaigns = await getCampaignsByTenant(tenant.id);
    const existingKeys = new Set(
      existingCampaigns.map((c) => `${c.postId}::${c.locationId ?? ""}`),
    );

    const created: CreatedCampaign[] = [];
    const skipped: { locationName: string; reason: string }[] = [];
    const errors: { locationName: string; error: string }[] = [];

    for (const location of locations) {
      const dedupeKey = `${postId}::${location.id}`;
      if (existingKeys.has(dedupeKey)) {
        skipped.push({ locationName: location.name, reason: "Already boosted at this location" });
        continue;
      }

      const campaignName = `SuperPulse v7 | ${location.name} | ${shortCaption}`;
      try {
        const campaignStart = Date.now();
        const campaign = await createCampaign(cleanAdAccountId, campaignName, token);
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
          `${location.name} ${location.radiusMiles}mi · £${dailyBudget}/day`,
          dailyBudget,
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
          postId,
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

        const activateStart = Date.now();
        await updateCampaignStatus(campaign.id, "ACTIVE", token);
        await logApiCall({
          tenantId: tenant.id,
          endpoint: `/${campaign.id}`,
          method: "POST",
          statusCode: 200,
          durationMs: Date.now() - activateStart,
        });

        await upsertCampaign(
          {
            postId,
            adAccountId: cleanAdAccountId,
            metaCampaignId: campaign.id,
            metaAdsetId: adSet.id,
            metaAdId: ad.id,
            status: "ACTIVE",
            dailyBudget,
            createdAt: new Date().toISOString(),
          },
          tenant.id,
          location.id,
        );

        created.push({
          locationId: location.id,
          locationName: location.name,
          campaignId: campaign.id,
          adSetId: adSet.id,
          adId: ad.id,
          status: "ACTIVE",
        });
        existingKeys.add(dedupeKey);

        await writeAuditEvent(
          tenant.id,
          "boost_activated",
          `Manual boost live for "${(caption || postId).toString().slice(0, 40)}" in ${location.name}`,
          { postId, locationId: location.id, metaCampaignId: campaign.id },
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await logApiCall({
          tenantId: tenant.id,
          endpoint: `/act_${cleanAdAccountId}/* (boost flow)`,
          method: "POST",
          statusCode: 500,
          durationMs: 0,
          error: message,
        });
        errors.push({ locationName: location.name, error: message });
      }
    }

    return NextResponse.json({
      success: created.length > 0,
      totalCreated: created.length,
      totalLocations: locations.length,
      campaigns: created,
      skipped,
      errors,
    });
  } catch (err) {
    console.error("Failed to create boost:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create boost: ${message}` },
      { status: 500 },
    );
  }
}
