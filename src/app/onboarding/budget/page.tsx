import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth";
import { getLocationsForTenant } from "@/lib/queries/locations";
import { PER_ADSET_FLOOR } from "@/lib/v8/budget-plan";
import { BudgetForm } from "./budget-form";

export const metadata: Metadata = {
  title: "Set Your Budget — SuperPulse",
};

export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  // Impersonation-aware: during "view as client" this resolves the client's
  // tenant (like the dashboard layout that redirects here for a provision_failed
  // budget-too-tight state), so operators can read the broken step instead of
  // being bounced to /login. Mutating writes stay blocked by impersonationGuard()
  // in /api/onboarding/budget.
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/login");
  // Allow both the first-time budget step and a provision_failed re-approval
  // (budget-too-tight): re-submitting flips the tenant back into 'provisioning'.
  if (
    tenant.provisioningStatus !== "pending_budget" &&
    tenant.provisioningStatus !== "provision_failed"
  ) {
    redirect("/dashboard");
  }
  const isRetry = tenant.provisioningStatus === "provision_failed";

  const locations = await getLocationsForTenant(tenant.id);
  const n = locations.length;

  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-screen bg-black px-6 py-12">
      <main className="w-full max-w-xl">
        <header className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-viridian">Super</span>
            <span className="text-sandstorm">Pulse</span>
          </h1>
          {isRetry && (
            <div className="mt-5 rounded-lg border border-sandstorm/40 bg-sandstorm/10 px-4 py-3 text-sm text-sandstorm">
              Your budget was a little too low to run steadily across {n}{" "}
              {n === 1 ? "location" : "locations"}. Nudge it up and we&apos;ll
              get your campaigns going.
            </div>
          )}
          <p className="mt-3 text-zinc-400 leading-relaxed">
            How much should each location spend per day? Every location runs as
            its own local ad set. This is your Meta ad spend, billed on your own
            ad account — separate from your SuperPulse subscription.
          </p>
        </header>

        <BudgetForm locationCount={n} minPerLocationDailyPennies={PER_ADSET_FLOOR} />

        <p className="mt-6 text-xs text-zinc-500 leading-relaxed">
          We recommend £5 per location per day — enough to deliver steadily in
          every area. You can change it any time, and SuperPulse keeps every
          location balanced within a 3× range so none runs away.
        </p>
      </main>
    </div>
  );
}
