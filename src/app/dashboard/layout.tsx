import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth";
import { setProvisioningStatus } from "@/lib/queries/tenants";
import { fetchMe } from "@/lib/facebook";
import { getLocationsForTenant } from "@/lib/queries/locations";
import { validateTenantBudget } from "@/lib/v8/budget-plan";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import { Wordmark } from "@/components/ui/Wordmark";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    redirect("/login");
  }

  // Offboarded clients (kicked via HQ) lose access entirely.
  if (tenant.status === "offboarded") {
    redirect("/login?reason=ended");
  }

  // Pre-OAuth flow gate — paid customers come through Stripe before connecting.
  // Legacy (grandfathered) and comp (prepaid via an HQ join link) bypass billing.
  if (!tenant.legacy && !tenant.comp) {
    if (
      !tenant.subscriptionStatus ||
      tenant.subscriptionStatus === "pending" ||
      tenant.subscriptionStatus === "canceled"
    ) {
      redirect("/pricing");
    }
    if (tenant.subscriptionStatus === "past_due") {
      redirect("/pricing?reason=past_due");
    }
  }

  if (!tenant.metaAccessToken) {
    redirect("/onboarding/connect");
  }
  if (tenant.status === "pending_page_selection") {
    redirect("/onboarding/select-page");
  }
  if (tenant.status === "pending_ad_account") {
    redirect("/onboarding/select-ad-account");
  }

  // v8 provisioning gates (additive, flag-gated). provisioning_status is NULL
  // for every existing tenant (legacy + active + in-flight) → no redirect, the
  // live funnel is byte-identical with V8_ENGINE_ENABLED off.
  if (process.env.V8_ENGINE_ENABLED === "on" && !tenant.legacy) {
    if (tenant.provisioningStatus === "pending_locations") {
      redirect("/onboarding/locations");
    }
    if (tenant.provisioningStatus === "pending_budget") {
      redirect("/onboarding/budget");
    }
    // provision_failed has two causes, recorded on the tenant by the provision
    // cron (provisioningFailedReason) — we branch on that stored cause rather
    // than re-deriving it from a live budget re-validation, which mis-classifies
    // once locations/budget change between cron-park and render.
    if (tenant.provisioningStatus === "provision_failed") {
      const reason = tenant.provisioningFailedReason;
      if (reason === "budget") {
        // Budget-too-tight is user-self-fixable. Re-check against the CURRENT
        // location count: if it now clears the floor (e.g. they removed
        // locations after parking), auto-resume into the cron instead of
        // stranding them on a healthy-looking dashboard that never provisions;
        // otherwise loop them back to re-approve a viable budget.
        const locs = await getLocationsForTenant(tenant.id);
        const budget = validateTenantBudget(tenant.monthlyAdBudgetPennies ?? 0, locs.length);
        if (budget.ok) {
          await setProvisioningStatus(tenant.id, "provisioning");
        } else {
          redirect("/onboarding/budget?reason=provision_failed");
        }
      } else if (reason == null) {
        // Legacy rows parked before provisioningFailedReason existed: fall back
        // to the old live re-derivation so they aren't stranded.
        const locs = await getLocationsForTenant(tenant.id);
        const budget = validateTenantBudget(tenant.monthlyAdBudgetPennies ?? 0, locs.length);
        if (!budget.ok) {
          redirect("/onboarding/budget?reason=provision_failed");
        }
      }
      // reason === "access": operational failure (the cron already Slack-alerted
      // Asad). Re-approving budget wouldn't help and would loop, so render the
      // dashboard, where the activity feed shows the failure.
    }
  }

  let user: { id: string; name: string; email?: string };
  try {
    user = await fetchMe(tenant.metaAccessToken);
  } catch {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-void text-white">
      <ImpersonationBanner />
      {/* Header */}
      <header className="border-b border-slate">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-4">
          <Wordmark href="/dashboard" />
          <nav className="hidden items-center gap-6 sm:flex">
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/dashboard/posts">Posts</NavLink>
            <NavLink href="/dashboard/locations">Locations</NavLink>
            <NavLink href="/dashboard/settings">Settings</NavLink>
          </nav>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-mist sm:inline">
              {user.name}
            </span>
            <a
              href="/api/auth/logout"
              className="inline-flex min-h-11 items-center text-sm text-mist transition-colors hover:text-white"
            >
              Log out
            </a>
          </div>
        </div>
        {/* Mobile nav — horizontal-scroll pill strip so 4 links never crowd/clip at 390px */}
        <div className="border-t border-slate sm:hidden">
          <div
            className="mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto px-6 py-2"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <NavPill href="/dashboard">Dashboard</NavPill>
            <NavPill href="/dashboard/posts">Posts</NavPill>
            <NavPill href="/dashboard/locations">Locations</NavPill>
            <NavPill href="/dashboard/settings">Settings</NavPill>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-sm text-mist transition-colors hover:text-white"
    >
      {children}
    </Link>
  );
}

function NavPill({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-transparent px-4 text-sm text-mist transition-colors hover:border-slate hover:bg-graphite hover:text-white"
    >
      {children}
    </Link>
  );
}
