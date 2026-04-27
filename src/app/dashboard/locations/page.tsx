import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantCookie } from "@/lib/auth";
import { getLocationsForTenant } from "@/lib/queries/locations";
import LocationsManager from "@/components/LocationsManager";

export const metadata: Metadata = {
  title: "Locations — SuperPulse",
  description: "Add the locations SuperPulse should target your boosts to.",
};

export default async function LocationsPage() {
  const tenantId = await getTenantCookie();
  if (!tenantId) redirect("/login");

  const locations = await getLocationsForTenant(tenantId);

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:text-white transition-colors"
        >
          ← Back to dashboard
        </Link>
        <h1 className="text-3xl font-bold mt-3">Your locations</h1>
        <p className="text-zinc-400 mt-2 max-w-xl">
          Add every location SuperPulse should target. Each address becomes a
          radius around which your Instagram boosts will run. You can change
          these any time.
        </p>
      </div>

      <LocationsManager initialLocations={locations} />
    </div>
  );
}
