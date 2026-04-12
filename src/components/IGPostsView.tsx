"use client";

import { useState, useEffect } from "react";
import PostCard from "./PostCard";
import type { IGPost } from "./PostCard";

interface IGAccount {
  pageId: string;
  pageName: string;
  igUserId: string;
}

interface Campaign {
  ig_post_id: string;
  status: "ACTIVE" | "PAUSED" | "ENDED";
  impressions?: number;
  reach?: number;
  clicks?: number;
  spend?: number;
}

interface IGPostsViewProps {
  igAccounts: IGAccount[];
  initialPosts: IGPost[];
  campaigns: Campaign[];
}

export default function IGPostsView({
  igAccounts,
  initialPosts,
  campaigns,
}: IGPostsViewProps) {
  const [selectedIg, setSelectedIg] = useState(
    igAccounts[0]?.igUserId ?? ""
  );
  const [posts, setPosts] = useState<IGPost[]>(initialPosts);
  const [loading, setLoading] = useState(false);

  const campaignMap = new Map<string, Campaign>();
  for (const c of campaigns) {
    campaignMap.set(c.ig_post_id, c);
  }

  useEffect(() => {
    // Don't refetch on initial render — initialPosts already matches the first account
    if (selectedIg === igAccounts[0]?.igUserId) return;

    async function fetchPosts() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/instagram/posts?igUserId=${encodeURIComponent(selectedIg)}`
        );
        if (res.ok) {
          const data = await res.json();
          setPosts(Array.isArray(data) ? data : []);
        } else {
          setPosts([]);
        }
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    }

    fetchPosts();
  }, [selectedIg, igAccounts]);

  return (
    <>
      {/* IG Account Selector */}
      {igAccounts.length > 1 && (
        <div className="mb-6">
          <label
            htmlFor="ig-selector"
            className="block text-sm font-medium text-zinc-400 mb-2"
          >
            Instagram Account
          </label>
          <select
            id="ig-selector"
            value={selectedIg}
            onChange={(e) => setSelectedIg(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-white text-sm focus:border-[#1EBA8F] focus:outline-none focus:ring-1 focus:ring-[#1EBA8F] transition-colors"
          >
            {igAccounts.map((acc) => (
              <option key={acc.igUserId} value={acc.igUserId}>
                {acc.pageName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-10">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#1EBA8F] border-t-transparent" />
          <p className="text-zinc-500 mt-3 text-sm">Loading posts...</p>
        </div>
      )}

      {/* Posts count */}
      {!loading && (
        <p className="text-zinc-500 mb-4">
          {posts.length} post{posts.length !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Posts grid */}
      {!loading && posts.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-10 text-center">
          <p className="text-zinc-400 text-lg font-medium">
            No Instagram posts found
          </p>
          <p className="text-zinc-500 text-sm mt-2">
            This account may not have any recent posts, or the Instagram
            Business account may not be linked.
          </p>
        </div>
      )}

      {!loading && posts.length > 0 && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => {
            const campaign = campaignMap.get(post.id);
            return (
              <PostCard
                key={post.id}
                post={post}
                status={campaign?.status ?? "NOT_BOOSTED"}
                impressions={campaign?.impressions}
                reach={campaign?.reach}
                clicks={campaign?.clicks}
                spend={campaign?.spend}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
