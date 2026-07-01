import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth";
import { fetchMe, fetchPagesWithIG, fetchAdAccounts } from "@/lib/facebook";
import type { PageWithIG, AdAccount } from "@/lib/facebook";
import StatusPanel from "@/components/StatusPanel";
import BoostControl from "@/components/BoostControl";
import { getLocationsForTenant } from "@/lib/queries/locations";
import { PageHeading } from "@/components/ui/PageHeading";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Dashboard | SuperPulse",
  description: "Your SuperPulse dashboard. Manage your Instagram ad boosting.",
};

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

  const locationCount = (await getLocationsForTenant(tenant.id)).length;

  const pagesWithIG = pages.filter((p) => p.instagram_business_account);
  const pagesWithoutIG = pages.filter((p) => !p.instagram_business_account);
  const filteredAdAccounts = adAccounts;

  return (
    <>
      {/* Welcome */}
      <PageHeading
        className="mb-10"
        title={`Welcome, ${user.name.split(" ")[0]}`}
        subtitle={user.email}
      />

      {/* Pause / Resume the whole engine (self-serve) */}
      <BoostControl initialPaused={tenant.selfPaused} />

      {/* Locations onboarding banner — only when none added yet */}
      {locationCount === 0 && (
        <Card
          variant="accent"
          className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div>
            <p className="font-semibold text-sandstorm">
              Add your locations to start boosting
            </p>
            <p className="mt-1 max-w-xl text-sm text-mist">
              SuperPulse targets each Instagram boost to a radius around a
              physical location. Add at least one address so your boosts know
              where to run.
            </p>
          </div>
          <Button
            href="/dashboard/locations"
            variant="sandstorm"
            className="shrink-0"
          >
            Add locations
          </Button>
        </Card>
      )}

      {/* Live status — replaces stats cards. Polls /api/status every 30s. */}
      <StatusPanel />

      {/* Quick Nav */}
      <section className="mb-10">
        <h3 className="mb-4 text-lg font-semibold text-white">Quick Actions</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/dashboard/posts" className="group block">
            <Card
              variant="subtle"
              className="flex items-center gap-3 transition-all hover:border-viridian/50 hover:bg-graphite"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-viridian/10">
                <svg
                  className="h-5 w-5 text-viridian"
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
                <p className="font-semibold text-white transition-colors group-hover:text-viridian">
                  Your Posts
                </p>
                <p className="text-sm text-mist">
                  View and manage boosted Instagram posts
                </p>
              </div>
            </Card>
          </Link>
          <Link href="/dashboard/settings" className="group block">
            <Card
              variant="subtle"
              className="flex items-center gap-3 transition-all hover:border-sandstorm/50 hover:bg-graphite"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sandstorm/10">
                <svg
                  className="h-5 w-5 text-sandstorm"
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
                <p className="font-semibold text-white transition-colors group-hover:text-sandstorm">
                  Boost Settings
                </p>
                <p className="text-sm text-mist">
                  Configure budget, radius, and boost preferences
                </p>
              </div>
            </Card>
          </Link>
        </div>
      </section>

      {/* Connected Pages with IG */}
      <section className="mb-10">
        <h3 className="mb-4 text-lg font-semibold text-viridian">
          Connected Pages with Instagram
        </h3>
        {pagesWithIG.length === 0 ? (
          <Card className="text-center">
            <p className="text-mist">
              No Pages with linked Instagram Business accounts found.
            </p>
            <p className="mt-2 text-sm text-mist">
              Make sure your Instagram account is converted to a Business or
              Creator account and linked to a Facebook Page.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {pagesWithIG.map((page) => (
              <Card key={page.id}>
                <p className="font-semibold text-white">{page.name}</p>
                <p className="mt-1 text-sm text-mist">
                  Page ID: {page.id}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-viridian" />
                  <span className="text-sm text-viridian">
                    IG Account: {page.instagram_business_account!.id}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Ad Accounts */}
      <section className="mb-10">
        <h3 className="mb-4 text-lg font-semibold text-sandstorm">
          Ad Accounts
        </h3>
        {filteredAdAccounts.length === 0 ? (
          <Card className="text-center">
            <p className="text-mist">No ad accounts found.</p>
            <p className="mt-2 text-sm text-mist">
              Make sure you have an ad account in Meta Business Manager.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredAdAccounts.map((account) => (
              <Card key={account.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white">{account.name}</p>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      account.account_status === 1
                        ? "border-viridian/30 bg-viridian/15 text-viridian"
                        : "border-sandstorm/30 bg-sandstorm/15 text-sandstorm"
                    }`}
                  >
                    {account.account_status === 1 ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-mist">
                  Account ID: {account.id}
                </p>
                <p className="mt-1 text-sm text-mist">
                  Currency: {account.currency}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Pages without IG */}
      {pagesWithoutIG.length > 0 && (
        <section>
          <h3 className="mb-4 text-lg font-semibold text-mist">
            Pages without Instagram
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {pagesWithoutIG.map((page) => (
              <Card key={page.id} variant="subtle">
                <p className="font-semibold text-mist">{page.name}</p>
                <p className="mt-1 text-sm text-shadow">
                  Page ID: {page.id}
                </p>
                <p className="mt-2 text-xs text-shadow">
                  No Instagram Business account linked
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
