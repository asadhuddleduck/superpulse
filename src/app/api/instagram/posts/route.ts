import { NextRequest, NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/auth";
import { fetchIGMedia } from "@/lib/facebook";
import type { IGPost } from "@/lib/types";

export async function GET(request: NextRequest) {
  const tenant = await getCurrentTenant();
  if (!tenant || !tenant.metaAccessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = tenant.metaAccessToken;

  try {
    const paramIgUserId = request.nextUrl.searchParams.get("igUserId");
    const igUserId = paramIgUserId ?? tenant.igUserId;

    if (!igUserId) {
      return NextResponse.json(
        { error: "No Instagram Business Account on tenant" },
        { status: 404 }
      );
    }
    const media = await fetchIGMedia(igUserId, token);

    const posts: IGPost[] = media.map((item) => {
      const likeCount = item.like_count ?? 0;
      const commentsCount = item.comments_count ?? 0;
      const totalEngagement = likeCount + commentsCount;
      // Engagement rate as a ratio (likes + comments) / 1000 as a baseline metric
      const engagementRate =
        totalEngagement > 0 ? totalEngagement / 1000 : 0;

      return {
        id: item.id,
        caption: item.caption ?? "",
        mediaType: item.media_type as IGPost["mediaType"],
        mediaUrl: item.media_url ?? "",
        thumbnailUrl: item.thumbnail_url ?? "",
        timestamp: item.timestamp,
        likeCount,
        commentsCount,
        engagementRate: Math.round(engagementRate * 10000) / 10000,
      };
    });

    return NextResponse.json(posts);
  } catch (err) {
    console.error("Failed to fetch Instagram posts:", err);
    return NextResponse.json(
      { error: "Failed to fetch Instagram posts" },
      { status: 500 }
    );
  }
}
