import { NextResponse } from "next/server";
import { getTokenCookie } from "@/lib/auth";
import {
  fetchPagesWithIG,
  fetchIGMedia,
  fetchAdAccounts,
  createCampaign,
  createAdSet,
  createAdCreative,
  createAd,
  updateCampaignStatus,
} from "@/lib/facebook";
import { getSettings } from "@/lib/queries/settings";
import { getActiveCampaigns, upsertCampaign } from "@/lib/queries/campaigns";
import { upsertPost } from "@/lib/queries/posts";

const DEFAULT_TENANT_ID = "default";

interface ScoredPost {
  id: string;
  caption: string;
  mediaType: string;
  mediaUrl: string;
  thumbnailUrl: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
  score: number;
}

/**
 * Score a post for boost eligibility.
 * Formula: (likeCount + commentsCount) / 1000 * recencyMultiplier * typeWeight
 */
function scorePost(post: {
  like_count?: number;
  comments_count?: number;
  timestamp: string;
  media_type: string;
}): number {
  const likeCount = post.like_count ?? 0;
  const commentsCount = post.comments_count ?? 0;
  const engagement = (likeCount + commentsCount) / 1000;

  // Recency multiplier based on post age
  const ageHours =
    (Date.now() - new Date(post.timestamp).getTime()) / (1000 * 60 * 60);
  let recencyMultiplier: number;
  if (ageHours < 24) {
    recencyMultiplier = 1.0;
  } else if (ageHours < 48) {
    recencyMultiplier = 0.8;
  } else if (ageHours < 72) {
    recencyMultiplier = 0.5;
  } else {
    recencyMultiplier = 0.2;
  }

  // Content type weight
  let typeWeight: number;
  switch (post.media_type) {
    case "VIDEO":
      typeWeight = 1.5;
      break;
    case "CAROUSEL_ALBUM":
      typeWeight = 1.2;
      break;
    default:
      typeWeight = 1.0;
  }

  return engagement * recencyMultiplier * typeWeight;
}

export async function POST() {
  const token = await getTokenCookie();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Check if smart boost is enabled
    const settings = await getSettings(DEFAULT_TENANT_ID);
    if (!settings.autoBoostEnabled) {
      return NextResponse.json({
        boosted: false,
        reason: "Smart boost is disabled",
      });
    }

    // 2. Get IG media
    const pages = await fetchPagesWithIG(token);
    const pageWithIG = pages.find((p) => p.instagram_business_account);

    if (!pageWithIG || !pageWithIG.instagram_business_account) {
      return NextResponse.json({
        boosted: false,
        reason: "No Instagram Business Account found",
      });
    }

    const igUserId = pageWithIG.instagram_business_account.id;
    const pageId = pageWithIG.id;
    const media = await fetchIGMedia(igUserId, token);

    // 3. Get ad account
    const adAccounts = await fetchAdAccounts(token);
    if (adAccounts.length === 0) {
      return NextResponse.json({
        boosted: false,
        reason: "No ad account found",
      });
    }

    const rawAdAccountId = adAccounts[0].id;
    const adAccountId = rawAdAccountId.startsWith("act_")
      ? rawAdAccountId.slice(4)
      : rawAdAccountId;

    // 4. Get already-active campaigns to exclude those posts
    const activeCampaigns = await getActiveCampaigns(DEFAULT_TENANT_ID);
    const boostedPostIds = new Set(activeCampaigns.map((c) => c.postId));

    // 5. Score each post and pick the best unboosted one
    const scored: ScoredPost[] = media
      .filter((m) => !boostedPostIds.has(m.id))
      .map((m) => ({
        id: m.id,
        caption: m.caption ?? "",
        mediaType: m.media_type,
        mediaUrl: m.media_url ?? "",
        thumbnailUrl: m.thumbnail_url ?? "",
        timestamp: m.timestamp,
        likeCount: m.like_count ?? 0,
        commentsCount: m.comments_count ?? 0,
        score: scorePost(m),
      }))
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      return NextResponse.json({
        boosted: false,
        reason: "No eligible posts to boost",
      });
    }

    const bestPost = scored[0];

    // 6. Save the post to Turso
    await upsertPost(
      {
        id: bestPost.id,
        mediaUrl: bestPost.mediaUrl,
        thumbnailUrl: bestPost.thumbnailUrl,
        caption: bestPost.caption,
        timestamp: bestPost.timestamp,
        likeCount: bestPost.likeCount,
        commentsCount: bestPost.commentsCount,
        mediaType: bestPost.mediaType as "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM",
        engagementRate: bestPost.score,
      },
      DEFAULT_TENANT_ID
    );

    // 7. Create campaign -> ad set -> ad (all PAUSED initially)
    const campaignName = `SP-Boost-${bestPost.id.slice(-8)}`;
    const campaign = await createCampaign(adAccountId, campaignName, token);

    // Default location: use centre of Birmingham as fallback (MVP)
    const lat = 52.4862;
    const lng = -1.8904;

    const adSet = await createAdSet(
      campaign.id,
      adAccountId,
      `${campaignName}-AdSet`,
      settings.dailyBudgetCap,
      settings.targetRadiusMiles,
      lat,
      lng,
      pageId,
      token
    );

    const creative = await createAdCreative(
      adAccountId,
      `${campaignName}-Creative`,
      bestPost.id,
      igUserId,
      pageId,
      token
    );

    const ad = await createAd(
      adSet.id,
      adAccountId,
      `${campaignName}-Ad`,
      creative.id,
      token
    );

    // 8. Activate the campaign
    await updateCampaignStatus(campaign.id, "ACTIVE", token);

    // 9. Save campaign to Turso
    await upsertCampaign(
      {
        postId: bestPost.id,
        adAccountId,
        metaCampaignId: campaign.id,
        metaAdsetId: adSet.id,
        metaAdId: ad.id,
        status: "ACTIVE",
        dailyBudget: settings.dailyBudgetCap,
        createdAt: new Date().toISOString(),
      },
      DEFAULT_TENANT_ID
    );

    return NextResponse.json({
      boosted: true,
      postId: bestPost.id,
      campaignId: campaign.id,
      score: bestPost.score,
    });
  } catch (err) {
    console.error("Scan-posts cron error:", err);
    return NextResponse.json(
      { error: "Failed to scan and boost posts" },
      { status: 500 }
    );
  }
}
