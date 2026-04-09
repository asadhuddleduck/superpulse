import { NextRequest, NextResponse } from "next/server";
import { getTokenCookie } from "@/lib/auth";
import {
  fetchPagesWithIG,
  fetchAdAccounts,
  createCampaign,
  createAdSet,
  createAdCreative,
  createAd,
} from "@/lib/facebook";

// Default location: Birmingham city centre (for demo — replaced by tenant location in production)
const DEFAULT_LAT = 52.4862;
const DEFAULT_LNG = -1.8904;

export async function POST(request: NextRequest) {
  const token = await getTokenCookie();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { postId, dailyBudget = 5, radiusMiles = 5, lat, lng } = body;

    if (!postId) {
      return NextResponse.json(
        { error: "postId is required" },
        { status: 400 }
      );
    }

    // Discover page and ad account from the user's connected assets
    const [pages, adAccounts] = await Promise.all([
      fetchPagesWithIG(token),
      fetchAdAccounts(token),
    ]);

    // Prefer the user's own Page (not agency/client Pages)
    const userPage = pages.find(
      (p) => p.instagram_business_account && p.name === "Asad Shah"
    );
    const pageWithIG = userPage ?? pages.find((p) => p.instagram_business_account);
    if (!pageWithIG) {
      return NextResponse.json(
        { error: "No connected Instagram Business Account found" },
        { status: 404 }
      );
    }

    // Prefer the SuperPulse ad account
    const superpulseAd = adAccounts.find((a) =>
      a.name.toLowerCase().includes("superpulse")
    );
    const orderedAdAccounts = superpulseAd
      ? [superpulseAd, ...adAccounts.filter((a) => a.id !== superpulseAd.id)]
      : adAccounts;

    if (orderedAdAccounts.length === 0) {
      return NextResponse.json(
        { error: "No ad account found" },
        { status: 404 }
      );
    }

    const pageId = pageWithIG.id;
    const rawAdAccountId = orderedAdAccounts[0].id;
    const adAccountId = rawAdAccountId.startsWith("act_")
      ? rawAdAccountId.slice(4)
      : rawAdAccountId;

    const targetLat = lat ?? DEFAULT_LAT;
    const targetLng = lng ?? DEFAULT_LNG;

    // Create campaign → ad set → ad, all in PAUSED state
    const campaign = await createCampaign(
      adAccountId,
      `SuperPulse Boost — ${postId.slice(-6)}`,
      token
    );

    const adSet = await createAdSet(
      campaign.id,
      adAccountId,
      `Local Reach — ${radiusMiles}mi radius`,
      dailyBudget,
      radiusMiles,
      targetLat,
      targetLng,
      token
    );

    // 2-step creative flow: create AdCreative first, then Ad referencing it
    const igUserId = pageWithIG.instagram_business_account!.id;
    const creative = await createAdCreative(
      adAccountId,
      `Creative — ${postId.slice(-6)}`,
      postId,
      igUserId,
      pageId,
      token
    );

    const ad = await createAd(
      adSet.id,
      adAccountId,
      `Boost — ${postId.slice(-6)}`,
      creative.id,
      token
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
      { status: 500 }
    );
  }
}
