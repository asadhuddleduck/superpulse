import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth";
import { fetchMe, fetchPagesWithIG, fetchAdAccounts } from "@/lib/facebook";
import type { PageWithIG, AdAccount } from "@/lib/facebook";
import SummaryCard from "@/components/SummaryCard";
import { getLocationsForTenant } from "@/lib/queries/locations";

export const metadata: Metadata = {
  title: "Dashboard — SuperPulse",
  description: "Your SuperPulse dashboard — manage your Instagram ad boosting.",
};

interface CampaignPerformance {
  total_spend: number;
  total_impressions: number;
  total_profile_visits: number;
  active_campaigns: number;
}

async function fetchCampaignStats(): Promise<CampaignPerformance | null> {
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

    if (!res.ok) return null;

    const campaigns = await res.json();
    if (!Array.isArray(campaigns)) return null;

    let totalSpend = 0;
    let totalImpressions = 0;
    let totalProfileVisits = 0;
    let activeCampaigns = 0;

    for (const c of campaigns) {
      totalSpend += c.spend ?? 0;
      totalImpressions += c.impressions ?? 0;
      totalProfileVisits += c.profile_visits ?? 0;
      if (c.status === "ACTIVE") activeCampaigns++;
    }

    return {
      total_spend: totalSpend,
      total_impressions: totalImpressions,
      total_profile_visits: totalProfileVisits,
      active_campaigns: activeCampaigns,
    };
  } catch {
    return null;
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default async function DashboardPage() {
  const tenant = await getCurrentTenant();
  if (!tenant || !tenant.metaAccessToken) redirect("/login");
  const token = tenant.metaAccessToken;

  let user: { id: string; name: string; email?: string } | null = null;
  let pages: PageWithIG[] = [];
  let adAccounts: AdAccount[] = [];

  try {
    user = await fetchMe(token);
  } catch {
    return null;
  }

  const [pagesResult, adAccountsResult] = await Promise.allSettled([
    fetchPagesWithIG(token),
    fetchAdAccounts(token),
  ]);
  if (pagesResult.status === "fulfilled") pages = pagesResult.value;
  if (adAccountsResult.status === "fulfilled") adAccounts = adAccountsResult.value;

  const stats = await fetchCampaignStats();

  const locationCount = (await getLocationsForTenant(tenant.id)).length;

  const pagesWithIG = pages.filter((p) => p.instagram_business_account);
  const pagesWithoutIG = pages.filter((p) => !p.instagram_business_account);
  const filteredAdAccounts = adAccounts;

  return (
    <>
      {/* Welcome */}
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-white">
          Welcome, {user.name.split(" ")[0]}
        </h2>
        {user.email && (
          <p className="text-zinc-500 mt-1">{user.email}</p>
        )}
      </div>

      {/* Locations onboarding banner — only when none added yet */}
      {locationCount === 0 && (
        <div className="mb-10 rounded-xl border border-sandstorm/40 bg-sandstorm/5 p-5 flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-sandstorm">
              Add your locations to start boosting
            </p>
            <p className="text-sm text-zinc-300 mt-1 max-w-xl">
              SuperPulse targets each Instagram boost to a radius around a
              physical location. Add at least one address so your boosts know
              where to run.
            </p>
          </div>
          <Link
            href="/dashboard/locations"
            className="shrink-0 rounded-lg bg-sandstorm px-4 py-2 text-sm font-semibold text-black hover:bg-sandstorm/90 transition"
          >
            Add locations
          </Link>
        </div>
      )}

      {/* Summary Cards */}
      <section className="mb-10">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Total Spend"
            value={stats ? stats.total_spend.toFixed(2) : "0.00"}
            prefix="£"
            trend={stats && stats.total_spend > 0 ? "up" : "neutral"}
          />
          <SummaryCard
            label="Total Impressions"
            value={stats ? formatNumber(stats.total_impressions) : "0"}
            trend={stats && stats.total_impressions > 0 ? "up" : "neutral"}
          />
          <SummaryCard
            label="Profile Visits"
            value={stats ? formatNumber(stats.total_profile_visits) : "0"}
            trend={stats && stats.total_profile_visits > 0 ? "up" : "neutral"}
          />
          <SummaryCard
            label="Active Campaigns"
            value={stats ? stats.active_campaigns.toString() : "0"}
            trend={
              stats && stats.active_campaigns > 0
                ? "up"
                : "neutral"
            }
          />
        </div>
      </section>

      {/* Quick Nav */}
      <section className="mb-10">
        <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/dashboard/posts"
            className="group rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 transition-all hover:border-[#1EBA8F]/50 hover:bg-zinc-900"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1EBA8F]/10">
                <svg
                  className="h-5 w-5 text-[#1EBA8F]"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-white group-hover:text-[#1EBA8F] transition-colors">
                  Your Posts
                </p>
                <p className="text-sm text-zinc-500">
                  View and manage boosted Instagram posts
                </p>
              </div>
            </div>
          </Link>
          <Link
            href="/dashboard/settings"
            className="group rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 transition-all hover:border-[#F7CE46]/50 hover:bg-zinc-900"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F7CE46]/10">
                <svg
                  className="h-5 w-5 text-[#F7CE46]"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-white group-hover:text-[#F7CE46] transition-colors">
                  Boost Settings
                </p>
                <p className="text-sm text-zinc-500">
                  Configure budget, radius, and boost preferences
                </p>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Connected Pages with IG */}
      <section className="mb-10">
        <h3 className="text-lg font-semibold text-viridian mb-4">
          Connected Pages with Instagram
        </h3>
        {pagesWithIG.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-center">
            <p className="text-zinc-400">
              No Pages with linked Instagram Business accounts found.
            </p>
            <p className="text-zinc-500 text-sm mt-2">
              Make sure your Instagram account is converted to a Business or
              Creator account and linked to a Facebook Page.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {pagesWithIG.map((page) => (
              <div
                key={page.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5"
              >
                <p className="font-semibold text-white">{page.name}</p>
                <p className="text-sm text-zinc-500 mt-1">
                  Page ID: {page.id}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-viridian" />
                  <span className="text-sm text-viridian">
                    IG Account: {page.instagram_business_account!.id}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Ad Accounts */}
      <section className="mb-10">
        <h3 className="text-lg font-semibold text-sandstorm mb-4">
          Ad Accounts
        </h3>
        {filteredAdAccounts.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-center">
            <p className="text-zinc-400">No ad accounts found.</p>
            <p className="text-zinc-500 text-sm mt-2">
              Make sure you have an ad account in Meta Business Manager.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredAdAccounts.map((account) => (
              <div
                key={account.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white">{account.name}</p>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      account.account_status === 1
                        ? "bg-[#1EBA8F]/15 text-[#1EBA8F] border-[#1EBA8F]/30"
                        : "bg-[#F7CE46]/15 text-[#F7CE46] border-[#F7CE46]/30"
                    }`}
                  >
                    {account.account_status === 1 ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 mt-1">
                  Account ID: {account.id}
                </p>
                <p className="text-sm text-zinc-500 mt-1">
                  Currency: {account.currency}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pages without IG */}
      {pagesWithoutIG.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-zinc-400 mb-4">
            Pages without Instagram
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {pagesWithoutIG.map((page) => (
              <div
                key={page.id}
                className="rounded-lg border border-zinc-800/50 bg-zinc-950 p-5"
              >
                <p className="font-semibold text-zinc-300">{page.name}</p>
                <p className="text-sm text-zinc-600 mt-1">
                  Page ID: {page.id}
                </p>
                <p className="text-xs text-zinc-600 mt-2">
                  No Instagram Business account linked
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
