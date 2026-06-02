import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTenantCookie } from "@/lib/auth";
import { getTenantById } from "@/lib/queries/tenants";
import { getLocationsForTenant } from "@/lib/queries/locations";
import { PER_ADSET_FLOOR } from "@/lib/v8/budget-plan";
import { BudgetForm } from "./budget-form";

export const metadata: Metadata = {
  title: "Set Your Budget — SuperPulse",
};

export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const tenantId = await getTenantCookie();
  if (!tenantId) redirect("/login");

  const tenant = await getTenantById(tenantId);
  if (!tenant) redirect("/login");
  if (tenant.provisioningStatus !== "pending_budget") redirect("/dashboard");

  const locations = await getLocationsForTenant(tenantId);
  const n = locations.length;

  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-screen bg-black px-6 py-12">
      <main className="w-full max-w-xl">
        <header className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-viridian">Super</span>
            <span className="text-sandstorm">Pulse</span>
          </h1>
          <p className="mt-3 text-zinc-400 leading-relaxed">
            How much should each location spend per day? Every location runs as
            its own local ad set. This is your Meta ad spend, billed on your own
            ad account — separate from your SuperPulse subscription.
          </p>
        </header>

        <BudgetForm locationCount={n} minPerLocationDailyPennies={PER_ADSET_FLOOR} />

        <p className="mt-6 text-xs text-zinc-500 leading-relaxed">
          Start small. Most owners run £1–£3 per location per day. You can change
          it any time, and SuperPulse keeps every location balanced within a 3×
          range so none runs away.
        </p>
      </main>
    </div>
  );
}
