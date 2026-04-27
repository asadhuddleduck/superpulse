import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth";
import { fetchPagesWithIG } from "@/lib/facebook";
import IGPostsView from "@/components/IGPostsView";
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

async function fetchPosts(igUserId: string): Promise<IGPost[]> {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const cookieHeader = allCookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const res = await fetch(
      `${baseUrl}/api/instagram/posts?igUserId=${encodeURIComponent(igUserId)}`,
      {
        headers: { cookie: cookieHeader },
        cache: "no-store",
      }
    );

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
  const tenant = await getCurrentTenant();
  if (!tenant || !tenant.metaAccessToken) redirect("/login");
  const token = tenant.metaAccessToken;

  const pages = await fetchPagesWithIG(token);
  const pagesWithIG = pages.filter((p) => p.instagram_business_account);

  const igAccounts = pagesWithIG.map((p) => ({
    pageId: p.id,
    pageName: p.name,
    igUserId: p.instagram_business_account!.id,
  }));

  // Default to the tenant's chosen IG account when present, else the first.
  const firstIgUserId = tenant.igUserId ?? igAccounts[0]?.igUserId ?? "";
  const [initialPosts, campaigns] = await Promise.all([
    firstIgUserId ? fetchPosts(firstIgUserId) : Promise.resolve([]),
    fetchCampaigns(),
  ]);

  return (
    <>
      {/* Header */}
      <div className="mb-8">
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
      </div>

      <IGPostsView
        igAccounts={igAccounts}
        initialPosts={initialPosts}
        campaigns={campaigns}
      />
    </>
  );
}
