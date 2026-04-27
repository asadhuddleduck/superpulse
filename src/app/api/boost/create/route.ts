import { NextRequest, NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/auth";
import {
  fetchIGUsername,
  createCampaign,
  createAdSet,
  createAdCreative,
  createAd,
  checkBoostEligibility,
} from "@/lib/facebook";
import { upsertTenant } from "@/lib/queries/tenants";

// Default location: Birmingham city centre. Used only if neither the
// caller nor the tenant row provides one.
const DEFAULT_LAT = 52.4862;
const DEFAULT_LNG = -1.8904;

export async function POST(request: NextRequest) {
  const tenant = await getCurrentTenant();
  if (!tenant || !tenant.metaAccessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = tenant.metaAccessToken;

  try {
    const body = await request.json();
    const { postId, caption = "", dailyBudget = 5, radiusMiles = 5, lat, lng } = body;
    const shortCaption =
      caption.replace(/[^\w\s]/g, "").trim().split(/\s+/).slice(0, 5).join(" ") ||
      postId.slice(-6);

    if (!postId) {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }

    if (!tenant.pageId || !tenant.igUserId || !tenant.adAccountId) {
      return NextResponse.json(
        { error: "Tenant is not fully connected. Re-run the onboarding flow to pick a Page." },
        { status: 412 },
      );
    }

    const eligibility = await checkBoostEligibility(postId, token);
    if (!eligibility.eligible) {
      return NextResponse.json(
        { error: `Post not eligible: ${eligibility.reason ?? "unknown"}` },
        { status: 400 },
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

    const targetLat = lat ?? DEFAULT_LAT;
    const targetLng = lng ?? DEFAULT_LNG;

    const campaign = await createCampaign(
      cleanAdAccountId,
      `SuperPulse v7 | ${shortCaption}`,
      token,
    );

    const adSet = await createAdSet(
      campaign.id,
      cleanAdAccountId,
      `${radiusMiles}mi · £${dailyBudget}/day`,
      dailyBudget,
      radiusMiles,
      targetLat,
      targetLng,
      pageId,
      token,
    );

    const creative = await createAdCreative(
      cleanAdAccountId,
      `SuperPulse v7 Creative | ${shortCaption}`,
      postId,
      igUserId,
      igUsername,
      pageId,
      token,
    );

    const ad = await createAd(
      adSet.id,
      cleanAdAccountId,
      `SP Ad | ${shortCaption}`,
      creative.id,
      token,
    );

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      adSetId: adSet.id,
      adId: ad.id,
      status: "PAUSED",
      dailyBudget,
      radiusMiles,
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
