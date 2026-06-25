import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHqUser, hasRole } from "@/lib/hq-auth";
import { getTenantById } from "@/lib/queries/tenants";
import { getLocationsForTenant } from "@/lib/queries/locations";
import { getCampaignCounts } from "@/lib/queries/campaigns";
import { getAggregatePerformance } from "@/lib/queries/performance";
import { getRecentEvents } from "@/lib/queries/audit-events";
import { getTenantHqActions } from "@/lib/hq-audit";
import {
  getStripeBilling,
  deriveStage,
  ONBOARDING_STEPS,
} from "@/lib/queries/hq-clients";
import { gbpFromPennies, gbpFromPounds, timeAgo, shortDate } from "@/lib/hq-format";
import { StageBadge, Pill } from "../../ui";
import ClientActions from "./actions";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-right text-sm text-zinc-200 break-all">{value ?? "—"}</span>
    </div>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireHqUser();
  const canAdmin = await hasRole(user, "admin");
  const { id } = await params;
  const { error } = await searchParams;

  const tenant = await getTenantById(id);
  if (!tenant) notFound();

  const [locations, counts, perf, events, opLog, billing] = await Promise.all([
    getLocationsForTenant(tenant.id),
    getCampaignCounts(tenant.id),
    getAggregatePerformance(tenant.id),
    getRecentEvents(tenant.id, 12),
    getTenantHqActions(tenant.id, 10),
    getStripeBilling(tenant.stripeSubscriptionId),
  ]);

  const { stage, stepIndex } = deriveStage({
    status: tenant.status,
    subscriptionStatus: tenant.subscriptionStatus,
    provisioningStatus: tenant.provisioningStatus,
    legacy: tenant.legacy,
    comp: tenant.comp,
    hqPaused: tenant.hqPaused,
    metaAccessTokenPresent: !!tenant.metaAccessToken,
    adAccountId: tenant.adAccountId,
    locationsCount: locations.length,
  });

  const name = tenant.name || tenant.igUsername || tenant.email || tenant.id;
  const offboarded = tenant.status === "offboarded";

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm text-zinc-500 hover:text-white">
        ← All clients
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{name}</h1>
            <StageBadge stage={stage} stepIndex={stepIndex} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            {tenant.igUsername && <span>@{tenant.igUsername}</span>}
            {tenant.email && <span>· {tenant.email}</span>}
            <span>· joined {shortDate(tenant.createdAt)}</span>
            {tenant.legacy && <Pill tone="amber">Legacy</Pill>}
            {tenant.comp && <Pill tone="green">Comped</Pill>}
          </div>
        </div>
        <ClientActions
          tenantId={tenant.id}
          hqPaused={tenant.hqPaused}
          comp={tenant.comp}
          offboarded={offboarded}
          canAdmin={canAdmin}
        />
      </div>

      {error === "forbidden" && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          You need an admin role to do that.
        </div>
      )}

      {offboarded && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          Access ended {tenant.offboardedAt ? shortDate(tenant.offboardedAt) : ""}. Billing canceled, ads paused.
        </div>
      )}

      {/* Onboarding stepper */}
      <Card title="Onboarding">
        <ol className="flex flex-wrap gap-x-2 gap-y-3">
          {ONBOARDING_STEPS.map((label, i) => {
            const done = stepIndex > i;
            const current = stepIndex === i;
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    done
                      ? "bg-viridian text-black"
                      : current
                        ? "bg-sandstorm text-black"
                        : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span className={`text-sm ${current ? "text-white" : done ? "text-zinc-300" : "text-zinc-600"}`}>
                  {label}
                </span>
                {i < ONBOARDING_STEPS.length - 1 && <span className="mx-1 text-zinc-700">→</span>}
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Billing */}
        <Card
          title="Billing"
          action={
            tenant.stripeCustomerId ? (
              <a
                href={`https://dashboard.stripe.com/customers/${tenant.stripeCustomerId}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-zinc-500 hover:text-viridian"
              >
                Stripe ↗
              </a>
            ) : undefined
          }
        >
          {tenant.legacy ? (
            <Row label="Plan" value="Legacy partner — £297/mo (grandfathered)" />
          ) : tenant.comp ? (
            <Row label="Plan" value="Comped — free access, no Stripe charge" />
          ) : billing ? (
            <>
              <Row
                label="Plan"
                value={
                  billing.amountPennies != null
                    ? `${gbpFromPennies(billing.amountPennies)}/${billing.interval ?? "mo"}`
                    : "£300/mo"
                }
              />
              <Row label="Status" value={billing.status} />
              {billing.discountLabel && <Row label="Discount" value={billing.discountLabel} />}
              <Row label="Renews" value={billing.currentPeriodEnd ? shortDate(billing.currentPeriodEnd) : "—"} />
              {billing.cancelAtPeriodEnd && <Row label="Note" value="Cancels at period end" />}
            </>
          ) : (
            <>
              <Row label="Plan" value="£300/mo (not yet subscribed)" />
              <Row label="Status" value={tenant.subscriptionStatus} />
            </>
          )}
        </Card>

        {/* Connected accounts */}
        <Card title="Connected accounts">
          <Row label="Instagram" value={tenant.igUsername ? `@${tenant.igUsername}` : "not connected"} />
          <Row label="IG user ID" value={tenant.igUserId} />
          <Row label="Facebook Page" value={tenant.pageId} />
          <Row label="Ad account" value={tenant.adAccountId} />
          <Row label="Meta token" value={tenant.metaAccessToken ? "connected ✓" : "missing"} />
          <Row label="Token expires" value={tenant.tokenExpiresAt ? shortDate(tenant.tokenExpiresAt) : "—"} />
        </Card>

        {/* Locations */}
        <Card title={`Locations (${locations.length})`}>
          {locations.length === 0 ? (
            <p className="text-sm text-zinc-600">No locations added yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {locations.map((l) => (
                <li key={l.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-200">{l.name}</span>
                  <span className="text-xs text-zinc-500">{l.radiusMiles} mi radius</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Performance */}
        <Card title="Performance">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-zinc-500">Spend to date</div>
              <div className="text-xl font-semibold text-white">{gbpFromPounds(perf.totalSpend)}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Profile visits</div>
              <div className="text-xl font-semibold text-white">{perf.totalProfileVisits.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Impressions</div>
              <div className="text-xl font-semibold text-white">{perf.totalImpressions.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Campaigns</div>
              <div className="text-xl font-semibold text-white">
                {counts.campaignsLive} <span className="text-sm font-normal text-zinc-500">live</span>
                <span className="text-sm font-normal text-zinc-600"> · {counts.campaignsPaused} paused</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Activity + operator log */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Recent activity">
          {events.length === 0 ? (
            <p className="text-sm text-zinc-600">Nothing yet.</p>
          ) : (
            <ul className="space-y-2">
              {events.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-zinc-300">{e.message}</span>
                  <span className="shrink-0 text-xs text-zinc-600">{timeAgo(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Operator log">
          {opLog.length === 0 ? (
            <p className="text-sm text-zinc-600">No operator actions yet.</p>
          ) : (
            <ul className="space-y-2">
              {opLog.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-zinc-300">{a.action.replace(/_/g, " ")}</span>
                  <span className="shrink-0 text-xs text-zinc-600">{timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
