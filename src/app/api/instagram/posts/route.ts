import { NextRequest, NextResponse } from "next/server";
import { getTokenCookie } from "@/lib/auth";
import { fetchPagesWithIG, fetchIGMedia } from "@/lib/facebook";
import type { IGPost } from "@/lib/types";

export async function GET(request: NextRequest) {
  const token = await getTokenCookie();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // If igUserId is provided as a query param, use it directly
    const paramIgUserId = request.nextUrl.searchParams.get("igUserId");

    let igUserId: string;

    if (paramIgUserId) {
      igUserId = paramIgUserId;
    } else {
      const pages = await fetchPagesWithIG(token);
      const pageWithIG = pages.find((p) => p.instagram_business_account);

      if (!pageWithIG || !pageWithIG.instagram_business_account) {
        return NextResponse.json(
          { error: "No Instagram Business Account found" },
          { status: 404 }
        );
      }

      igUserId = pageWithIG.instagram_business_account.id;
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
