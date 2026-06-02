import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTenantCookie } from "@/lib/auth";
import { getTenantById } from "@/lib/queries/tenants";
import { getLocationsForTenant } from "@/lib/queries/locations";
import LocationsManager from "@/components/LocationsManager";
import { ContinueToBudget } from "./continue-to-budget";

export const metadata: Metadata = {
  title: "Add Your Locations — SuperPulse",
};

export const dynamic = "force-dynamic";

export default async function OnboardingLocationsPage() {
  const tenantId = await getTenantCookie();
  if (!tenantId) redirect("/login");

  const tenant = await getTenantById(tenantId);
  if (!tenant) redirect("/login");
  if (tenant.provisioningStatus !== "pending_locations") redirect("/dashboard");

  const locations = await getLocationsForTenant(tenantId);

  return (
    <div className="min-h-screen bg-black px-6 py-12">
      <main className="mx-auto w-full max-w-2xl">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-viridian">Super</span>
            <span className="text-sandstorm">Pulse</span>
          </h1>
          <p className="mt-3 text-zinc-400 leading-relaxed">
            Add every location SuperPulse should boost to. Each one becomes its
            own local ad set. Got a lot? Use &ldquo;Add many at once&rdquo;.
          </p>
        </header>

        <LocationsManager initialLocations={locations} />

        <ContinueToBudget />
      </main>
    </div>
  );
}
