import Link from "next/link";
import { listClientsSummary, rosterStats, type ClientSummary } from "@/lib/queries/hq-clients";
import { gbpFromPennies, gbpFromPounds, timeAgo } from "@/lib/hq-format";
import { StageBadge, StatCard } from "./ui";

export const dynamic = "force-dynamic";

type Filter = "all" | "live" | "onboarding" | "paused" | "churned" | "legacy";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "onboarding", label: "Onboarding" },
  { key: "paused", label: "Paused" },
  { key: "churned", label: "Churned" },
  { key: "legacy", label: "Legacy" },
];

function matchesFilter(c: ClientSummary, f: Filter): boolean {
  switch (f) {
    case "live":
      return c.status !== "offboarded" && !c.hqPaused && c.stepIndex >= 6;
    case "onboarding":
      return c.status !== "offboarded" && !c.hqPaused && c.stepIndex >= 0 && c.stepIndex < 6;
    case "paused":
      return c.hqPaused && c.status !== "offboarded";
    case "churned":
      return c.status === "offboarded" || c.subscriptionStatus === "canceled";
    case "legacy":
      return c.legacy;
    default:
      return true;
  }
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const { filter: rawFilter, q: rawQ } = await searchParams;
  const filter = (FILTERS.find((f) => f.key === rawFilter)?.key ?? "all") as Filter;
  const q = (rawQ ?? "").trim().toLowerCase();

  const all = await listClientsSummary();
  const stats = rosterStats(all);

  const clients = all.filter((c) => {
    if (!matchesFilter(c, filter)) return false;
    if (!q) return true;
    return [c.name, c.igUsername, c.email, c.id].some((v) => v?.toLowerCase().includes(q));
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-zinc-500">Everyone on SuperPulse, at a glance.</p>
        </div>
        <Link
          href="/admin/links"
          className="rounded-lg bg-viridian px-4 py-2 text-sm font-semibold text-black hover:bg-viridian/90"
        >
          + Add client
        </Link>
      </div>

      {/* Headline stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Clients" value={stats.total} />
        <StatCard label="Live" value={stats.live} />
        <StatCard label="Onboarding" value={stats.onboarding} />
        <StatCard label="Churned" value={stats.churned} />
        <StatCard label="Est. MRR" value={gbpFromPennies(stats.mrrPennies)} sub="active + legacy" />
      </div>

      {/* Filter tabs + search */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => {
            const params = new URLSearchParams();
            if (f.key !== "all") params.set("filter", f.key);
            if (q) params.set("q", q);
            const href = `/admin${params.toString() ? `?${params}` : ""}`;
            const active = f.key === filter;
            return (
              <Link
                key={f.key}
                href={href}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  active ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
        <form method="get" action="/admin" className="flex items-center gap-2">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, @handle, email…"
            className="w-56 rounded-lg border border-zinc-800 bg-black px-3 py-1.5 text-sm outline-none focus:border-viridian"
          />
        </form>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-900">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 font-medium">Business</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Accounts</th>
              <th className="px-4 py-3 font-medium text-right">Spend (mo)</th>
              <th className="px-4 py-3 font-medium text-right">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-b border-zinc-900/60 last:border-0 hover:bg-zinc-950">
                <td className="px-4 py-3">
                  <Link href={`/admin/clients/${encodeURIComponent(c.id)}`} className="block">
                    <div className="font-medium text-white">{c.name || c.igUsername || c.email || c.id}</div>
                    <div className="text-xs text-zinc-500">
                      {c.igUsername ? `@${c.igUsername}` : c.email || "—"}
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StageBadge stage={c.stage} stepIndex={c.stepIndex} />
                </td>
                <td className="px-4 py-3 text-zinc-300">{c.planLabel}</td>
                <td className="px-4 py-3 text-zinc-400">
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    <span title="Ad account">{c.adAccountId ? "Ad acct ✓" : "Ad acct —"}</span>
                    <span title="Locations">{c.locationsCount} loc</span>
                    <span title="Live campaigns">{c.campaignsLive} live</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-zinc-300">{gbpFromPounds(c.spendThisMonth)}</td>
                <td className="px-4 py-3 text-right text-zinc-500">{timeAgo(c.lastActivity)}</td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-zinc-600">
                  No clients{q ? " match your search" : ""} yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
