"use client";

import { useState } from "react";
import StatusBadge from "./StatusBadge";
import { Button } from "@/components/ui/Button";

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
          caption: post.caption,
          dailyBudget: budget,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("PAUSED");
        const created = data.totalCreated ?? 0;
        const total = data.totalLocations ?? 0;
        const errorCount = Array.isArray(data.errors) ? data.errors.length : 0;
        let msg: string;
        if (created === 0 && errorCount === 0) {
          msg = "Already boosted at all your locations";
        } else if (created === total) {
          msg = `Created ${created} campaign${created === 1 ? "" : "s"} across your locations`;
        } else {
          msg = `Created ${created} of ${total} campaigns${errorCount ? ` (${errorCount} failed)` : ""}`;
        }
        setBoostResult(msg);
        setShowBoostForm(false);
      } else {
        setBoostResult(data.error || "Failed to create boost");
      }
    } catch {
      setBoostResult("Network error, please try again");
    } finally {
      setBoostLoading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate bg-graphite transition-all hover:border-mist/40">
      {/* Thumbnail */}
      <div className="relative aspect-square bg-slate">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={captionSnippet}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-shadow">
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
          <span className="absolute top-2 left-2 rounded bg-void/70 px-2 py-0.5 text-xs font-medium text-white">
            VIDEO
          </span>
        )}
        {post.mediaType === "CAROUSEL_ALBUM" && (
          <span className="absolute top-2 left-2 rounded bg-void/70 px-2 py-0.5 text-xs font-medium text-white">
            CAROUSEL
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm leading-snug text-white line-clamp-2">
            {captionSnippet}
          </p>
          <StatusBadge status={status} />
        </div>

        {/* Engagement row */}
        <div className="mt-3 flex items-center gap-4 text-xs text-mist">
          <span>{post.likeCount} likes</span>
          <span>{post.commentsCount} comments</span>
        </div>

        {/* Boost metrics (when already boosted) */}
        {isBoosted && (
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate pt-3 sm:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-mist">
                Impr
              </p>
              <p className="font-mono text-sm font-medium tabular-nums text-white">
                {impressions != null ? formatNumber(impressions) : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-mist">
                Reach
              </p>
              <p className="font-mono text-sm font-medium tabular-nums text-white">
                {reach != null ? formatNumber(reach) : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-mist">
                Clicks
              </p>
              <p className="font-mono text-sm font-medium tabular-nums text-white">
                {clicks != null ? formatNumber(clicks) : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-mist">
                Spend
              </p>
              <p className="font-mono text-sm font-medium tabular-nums text-white">
                {spend != null ? `£${spend.toFixed(2)}` : "-"}
              </p>
            </div>
          </div>
        )}

        {/* Boost button + form (only for non-boosted posts) */}
        {!isBoosted && !showBoostForm && (
          <Button
            variant="primary"
            fullWidth
            onClick={() => setShowBoostForm(true)}
            className="mt-4"
          >
            Boost This Post
          </Button>
        )}

        {/* Boost form */}
        {!isBoosted && showBoostForm && (
          <div className="mt-4 space-y-3 rounded-lg border border-slate bg-graphite/50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">Create Boost</p>
              <button
                onClick={() => {
                  setShowBoostForm(false);
                  setBoostResult(null);
                }}
                className="text-xs text-mist transition-colors hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div>
              <label htmlFor={`budget-${post.id}`} className="text-xs text-mist">
                Daily budget
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mist">
                  £
                </span>
                <input
                  id={`budget-${post.id}`}
                  type="number"
                  min={1}
                  max={100}
                  step={0.5}
                  value={budget}
                  onChange={(e) => setBudget(parseFloat(e.target.value) || 5)}
                  className="min-h-11 w-full rounded-lg border border-slate bg-graphite py-2.5 pl-7 pr-3 text-sm text-white transition-colors focus:border-viridian focus:outline-none"
                />
              </div>
            </div>

            <p className="text-xs leading-relaxed text-mist">
              Targets each of your locations using its own radius. Manage
              locations and radii in Settings.
            </p>

            <Button
              variant="primary"
              fullWidth
              onClick={handleBoost}
              disabled={boostLoading}
              loading={boostLoading}
            >
              {boostLoading ? "Creating..." : "Create Boost (Paused)"}
            </Button>
          </div>
        )}

        {/* Boost result message */}
        {boostResult && (
          <div
            className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${
              status === "PAUSED"
                ? "border border-viridian/20 bg-viridian/10 text-viridian"
                : "border border-red-500/20 bg-red-500/10 text-red-400"
            }`}
          >
            {boostResult}
          </div>
        )}
      </div>
    </div>
  );
}
