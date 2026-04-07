import { NextResponse } from "next/server";
import { getTokenCookie } from "@/lib/auth";
import {
  fetchAdAccounts,
  fetchAdInsights,
  updateCampaignStatus as updateMetaCampaignStatus,
} from "@/lib/facebook";
import { getActiveCampaigns, updateCampaignStatus } from "@/lib/queries/campaigns";
import { upsertPerformance } from "@/lib/queries/performance";

const DEFAULT_TENANT_ID = "default";

export async function POST() {
  const token = await getTokenCookie();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch active campaigns from Turso
    const activeCampaigns = await getActiveCampaigns(DEFAULT_TENANT_ID);

    if (activeCampaigns.length === 0) {
      return NextResponse.json({
        monitored: 0,
        paused: 0,
        message: "No active campaigns to monitor",
      });
    }

    // 2. Get ad account for insights
    const adAccounts = await fetchAdAccounts(token);
    if (adAccounts.length === 0) {
      return NextResponse.json(
        { error: "No ad account found" },
        { status: 404 }
      );
    }

    const rawAdAccountId = adAccounts[0].id;
    const adAccountId = rawAdAccountId.startsWith("act_")
      ? rawAdAccountId.slice(4)
      : rawAdAccountId;

    // 3. Get insights from Meta API
    const insights = await fetchAdInsights(adAccountId, token);

    // Build lookup by campaign_id
    const insightsMap = new Map<
      string,
      {
        impressions: number;
        reach: number;
        clicks: number;
        spend: number;
      }
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

    const today = new Date().toISOString().split("T")[0];
    const paused: string[] = [];

    // 4. Process each active campaign
    for (const campaign of activeCampaigns) {
      const perf = insightsMap.get(campaign.metaCampaignId);

      if (perf) {
        // Upsert performance data into Turso
        await upsertPerformance({
          campaignId: campaign.metaCampaignId,
          date: today,
          impressions: perf.impressions,
          reach: perf.reach,
          clicks: perf.clicks,
          spend: perf.spend,
          profileVisits: 0, // Profile visits require separate media insights call
        });

        // 5. Pause underperformers: spend > 2.00 and CTR < 0.005
        const ctr =
          perf.impressions > 0 ? perf.clicks / perf.impressions : 0;

        if (perf.spend > 2.0 && ctr < 0.005) {
          // Pause on Meta
          await updateMetaCampaignStatus(
            campaign.metaCampaignId,
            "PAUSED",
            token
          );
          // Update in Turso
          await updateCampaignStatus(campaign.metaCampaignId, "PAUSED");
          paused.push(campaign.metaCampaignId);
        }
      }
    }

    return NextResponse.json({
      monitored: activeCampaigns.length,
      paused: paused.length,
      pausedCampaigns: paused,
      date: today,
    });
  } catch (err) {
    console.error("Monitor cron error:", err);
    return NextResponse.json(
      { error: "Failed to monitor campaigns" },
      { status: 500 }
    );
  }
}
