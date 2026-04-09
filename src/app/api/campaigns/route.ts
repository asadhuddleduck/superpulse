import { NextResponse } from "next/server";
import { getTokenCookie } from "@/lib/auth";
import {
  fetchAdAccounts,
  fetchCampaigns,
  fetchAdInsights,
} from "@/lib/facebook";

export async function GET() {
  const token = await getTokenCookie();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adAccounts = await fetchAdAccounts(token);
    if (adAccounts.length === 0) {
      return NextResponse.json(
        { error: "No ad accounts found" },
        { status: 404 }
      );
    }

    // Use the first ad account (strip the "act_" prefix if present)
    const rawId = adAccounts[0].id;
    const adAccountId = rawId.startsWith("act_") ? rawId.slice(4) : rawId;

    const [campaigns, insights] = await Promise.all([
      fetchCampaigns(adAccountId, token),
      fetchAdInsights(adAccountId, token),
    ]);

    // Build a lookup of insights by campaign_id
    const insightsMap = new Map<
      string,
      { impressions: number; reach: number; clicks: number; spend: number }
    >();
    for (const entry of insights) {
      if (entry.campaign_id) {
        insightsMap.set(entry.campaign_id, {
          impressions: parseInt(entry.impressions, 10),
          reach: parseInt(entry.reach, 10),
          clicks: parseInt(entry.clicks, 10),
          spend: parseFloat(entry.spend),
        });
      }
    }

    // Merge campaigns with their performance data
    const campaignsWithPerformance = campaigns.map((c) => {
      const perf = insightsMap.get(c.id);
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        daily_budget: c.daily_budget,
        created_time: c.created_time,
        impressions: perf?.impressions ?? 0,
        reach: perf?.reach ?? 0,
        clicks: perf?.clicks ?? 0,
        spend: perf?.spend ?? 0,
      };
    });

    return NextResponse.json(campaignsWithPerformance);
  } catch (err) {
    console.error("Failed to fetch campaigns:", err);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
