"use client";

import { useState } from "react";
import StatusBadge from "./StatusBadge";

export interface IGPost {
  id: string;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  mediaUrl: string;
  thumbnailUrl: string;
  caption: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
  engagementRate: number;
}

type BoostStatus = "ACTIVE" | "PAUSED" | "ENDED" | "NOT_BOOSTED";

interface PostCardProps {
  post: IGPost;
  status?: BoostStatus;
  impressions?: number;
  reach?: number;
  clicks?: number;
  spend?: number;
}

interface Insights {
  views?: number;
  reach?: number;
  saved?: number;
  shares?: number;
  profile_visits?: number;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function PostCard({
  post,
  status: initialStatus = "NOT_BOOSTED",
  impressions,
  reach,
  clicks,
  spend,
}: PostCardProps) {
  const [status, setStatus] = useState<BoostStatus>(initialStatus);
  const [showBoostForm, setShowBoostForm] = useState(false);
  const [boostLoading, setBoostLoading] = useState(false);
  const [boostResult, setBoostResult] = useState<string | null>(null);
  const [budget, setBudget] = useState(5);
  const [radius, setRadius] = useState(5);

  // Insights state
  const [insights, setInsights] = useState<Insights | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const imageUrl =
    post.mediaType === "VIDEO" ? post.thumbnailUrl : post.mediaUrl;
  const captionSnippet = post.caption
    ? post.caption.length > 60
      ? post.caption.slice(0, 60) + "..."
      : post.caption
    : "No caption";

  const isBoosted = status !== "NOT_BOOSTED";

  async function handleBoost() {
    setBoostLoading(true);
    setBoostResult(null);
    try {
      const res = await fetch("/api/boost/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: post.id,
          dailyBudget: budget,
          radiusMiles: radius,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("PAUSED");
        setBoostResult("Campaign created in review state");
        setShowBoostForm(false);
      } else {
        setBoostResult(data.error || "Failed to create boost");
      }
    } catch {
      setBoostResult("Network error — please try again");
    } finally {
      setBoostLoading(false);
    }
  }

  async function toggleInsights() {
    if (insightsOpen) {
      setInsightsOpen(false);
      return;
    }
    setInsightsOpen(true);
    if (insights) return; // already fetched

    setInsightsLoading(true);
    try {
      const res = await fetch(`/api/instagram/insights/${post.id}?type=${post.mediaType}`);
      if (res.ok) {
        const data = await res.json();
        setInsights(data.metrics ?? {});
      }
    } catch {
      // silently fail — insights are supplementary
    } finally {
      setInsightsLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden transition-all hover:border-zinc-700">
      {/* Thumbnail */}
      <div className="relative aspect-square bg-zinc-800">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={captionSnippet}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-600">
            <svg
              className="h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
              />
            </svg>
          </div>
        )}
        {post.mediaType === "VIDEO" && (
          <span className="absolute top-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            VIDEO
          </span>
        )}
        {post.mediaType === "CAROUSEL_ALBUM" && (
          <span className="absolute top-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            CAROUSEL
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-zinc-300 leading-snug line-clamp-2">
            {captionSnippet}
          </p>
          <StatusBadge status={status} />
        </div>

        {/* Engagement row */}
        <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
          <span>{post.likeCount} likes</span>
          <span>{post.commentsCount} comments</span>
          <button
            onClick={toggleInsights}
            className="ml-auto text-[#1EBA8F] hover:text-[#1EBA8F]/80 transition-colors"
          >
            {insightsOpen ? "Hide insights" : "View insights"}
          </button>
        </div>

        {/* Insights panel */}
        {insightsOpen && (
          <div className="mt-3 border-t border-zinc-800 pt-3">
            {insightsLoading ? (
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 rounded bg-zinc-800 animate-pulse" />
                ))}
              </div>
            ) : insights ? (
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    Views
                  </p>
                  <p className="text-sm font-medium text-white">
                    {insights.views != null
                      ? formatNumber(insights.views)
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    Reach
                  </p>
                  <p className="text-sm font-medium text-white">
                    {insights.reach != null
                      ? formatNumber(insights.reach)
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    Saved
                  </p>
                  <p className="text-sm font-medium text-white">
                    {insights.saved != null
                      ? formatNumber(insights.saved)
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    Shares
                  </p>
                  <p className="text-sm font-medium text-white">
                    {insights.shares != null
                      ? formatNumber(insights.shares)
                      : "-"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                Insights unavailable for this post
              </p>
            )}
          </div>
        )}

        {/* Boost metrics (when already boosted) */}
        {isBoosted && (
          <div className="mt-3 grid grid-cols-4 gap-2 border-t border-zinc-800 pt-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Impr
              </p>
              <p className="text-sm font-medium text-white">
                {impressions != null ? formatNumber(impressions) : "-"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Reach
              </p>
              <p className="text-sm font-medium text-white">
                {reach != null ? formatNumber(reach) : "-"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Clicks
              </p>
              <p className="text-sm font-medium text-white">
                {clicks != null ? formatNumber(clicks) : "-"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Spend
              </p>
              <p className="text-sm font-medium text-white">
                {spend != null ? `£${spend.toFixed(2)}` : "-"}
              </p>
            </div>
          </div>
        )}

        {/* Boost button + form (only for non-boosted posts) */}
        {!isBoosted && !showBoostForm && (
          <button
            onClick={() => setShowBoostForm(true)}
            className="mt-4 w-full rounded-lg bg-[#1EBA8F] px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-[#1EBA8F]/90 hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-[#1EBA8F]/20"
          >
            Boost This Post
          </button>
        )}

        {/* Boost form */}
        {!isBoosted && showBoostForm && (
          <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">Create Boost</p>
              <button
                onClick={() => {
                  setShowBoostForm(false);
                  setBoostResult(null);
                }}
                className="text-xs text-zinc-500 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>

            <div>
              <label className="text-xs text-zinc-400">
                Daily budget
              </label>
              <div className="mt-1 relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">
                  £
                </span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  step={0.5}
                  value={budget}
                  onChange={(e) => setBudget(parseFloat(e.target.value) || 5)}
                  className="w-full rounded border border-zinc-600 bg-zinc-900 pl-6 pr-3 py-1.5 text-sm text-white focus:border-[#1EBA8F] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400">
                Target radius
              </label>
              <div className="mt-1 relative">
                <input
                  type="number"
                  min={1}
                  max={50}
                  step={1}
                  value={radius}
                  onChange={(e) => setRadius(parseInt(e.target.value) || 5)}
                  className="w-full rounded border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-sm text-white focus:border-[#1EBA8F] focus:outline-none"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">
                  miles
                </span>
              </div>
            </div>

            <button
              onClick={handleBoost}
              disabled={boostLoading}
              className="w-full rounded-lg bg-[#1EBA8F] px-4 py-2 text-sm font-semibold text-black transition-all hover:bg-[#1EBA8F]/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {boostLoading ? "Creating..." : "Create Boost (Paused)"}
            </button>
          </div>
        )}

        {/* Boost result message */}
        {boostResult && (
          <div
            className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${
              status === "PAUSED"
                ? "bg-[#1EBA8F]/10 text-[#1EBA8F] border border-[#1EBA8F]/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {boostResult}
          </div>
        )}
      </div>
    </div>
  );
}
