import StatusBadge from "./StatusBadge";

export interface IGPost {
  id: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  caption?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  permalink?: string;
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
  status = "NOT_BOOSTED",
  impressions,
  reach,
  clicks,
  spend,
}: PostCardProps) {
  const imageUrl =
    post.media_type === "VIDEO" ? post.thumbnail_url : post.media_url;
  const captionSnippet = post.caption
    ? post.caption.length > 60
      ? post.caption.slice(0, 60) + "..."
      : post.caption
    : "No caption";

  const isBoosted = status !== "NOT_BOOSTED";

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
        {/* Media type badge */}
        {post.media_type === "VIDEO" && (
          <span className="absolute top-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            VIDEO
          </span>
        )}
        {post.media_type === "CAROUSEL_ALBUM" && (
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

        {/* Engagement row (always shown) */}
        <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
          <span>{post.like_count ?? 0} likes</span>
          <span>{post.comments_count ?? 0} comments</span>
        </div>

        {/* Boost metrics (only when boosted) */}
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
      </div>
    </div>
  );
}
