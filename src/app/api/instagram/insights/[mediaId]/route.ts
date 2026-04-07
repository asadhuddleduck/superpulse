import { NextRequest, NextResponse } from "next/server";
import { getTokenCookie } from "@/lib/auth";
import { fetchMediaInsights } from "@/lib/facebook";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const token = await getTokenCookie();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { mediaId } = await params;

  try {
    const insights = await fetchMediaInsights(mediaId, token);

    // Transform the insights array into a flat metrics object
    const metrics: Record<string, number> = {};
    for (const insight of insights) {
      if (insight.values && insight.values.length > 0) {
        metrics[insight.name] = insight.values[0].value;
      }
    }

    return NextResponse.json({ mediaId, metrics });
  } catch (err) {
    console.error("Failed to fetch media insights:", err);
    return NextResponse.json(
      { error: "Failed to fetch media insights" },
      { status: 500 }
    );
  }
}
