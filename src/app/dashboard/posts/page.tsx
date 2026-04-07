import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import PostCard from "@/components/PostCard";
import type { IGPost } from "@/components/PostCard";

export const metadata: Metadata = {
  title: "Your Posts — SuperPulse",
  description: "View and manage your Instagram posts and boost campaigns.",
};

interface Campaign {
  ig_post_id: string;
  status: "ACTIVE" | "PAUSED" | "ENDED";
  impressions?: number;
  reach?: number;
  clicks?: number;
  spend?: number;
}

async function fetchPosts(): Promise<IGPost[]> {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const cookieHeader = allCookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/instagram/posts`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });

    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function fetchCampaigns(): Promise<Campaign[]> {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const cookieHeader = allCookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/campaigns`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });

    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function PostsPage() {
  const [posts, campaigns] = await Promise.all([
    fetchPosts(),
    fetchCampaigns(),
  ]);

  // Map campaigns by IG post ID for quick lookup
  const campaignMap = new Map<string, Campaign>();
  for (const c of campaigns) {
    campaignMap.set(c.ig_post_id, c);
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 hover:text-white transition-colors mb-2 inline-flex items-center gap-1"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5 8.25 12l7.5-7.5"
              />
            </svg>
            Back to Dashboard
          </Link>
          <h2 className="text-3xl font-bold text-white">Your Posts</h2>
          <p className="text-zinc-500 mt-1">
            {posts.length} post{posts.length !== 1 ? "s" : ""} found
          </p>
        </div>
      </div>

      {/* Posts grid */}
      {posts.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-10 text-center">
          <svg
            className="mx-auto h-12 w-12 text-zinc-600 mb-4"
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
          <p className="text-zinc-400 text-lg font-medium">
            No Instagram posts found
          </p>
          <p className="text-zinc-500 text-sm mt-2">
            Connect your Instagram account first, then your posts will appear
            here.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center rounded-lg bg-[#1EBA8F] px-6 py-2.5 text-sm font-semibold text-black transition-all hover:bg-[#1EBA8F]/90 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#1EBA8F]/20"
          >
            Go to Dashboard
          </Link>
        </div>
      ) : (
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
