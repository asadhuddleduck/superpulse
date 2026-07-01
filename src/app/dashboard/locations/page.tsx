import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth";
import { getLocationsForTenant } from "@/lib/queries/locations";
import { resolveSeatCap } from "@/lib/seats";
import LocationsManager from "@/components/LocationsManager";
import { PageHeading } from "@/components/ui/PageHeading";

export const metadata: Metadata = {
  title: "Locations | SuperPulse",
  description: "Add the locations SuperPulse should target your boosts to.",
};

export default async function LocationsPage() {
  // Impersonation-aware: during "view as client" this reads the client's tenant.
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/login");

  const [locations, cap] = await Promise.all([
    getLocationsForTenant(tenant.id),
    resolveSeatCap(tenant),
  ]);

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center text-sm text-mist transition-colors hover:text-white"
        >
          ← Back to dashboard
        </Link>
        <PageHeading
          className="mt-3"
          title="Your locations"
          subtitle="Add every location SuperPulse should target. Each address becomes a radius around which your Instagram boosts will run. You can change these any time."
        />
      </div>

      <LocationsManager
        initialLocations={locations}
        paidLocations={cap === Infinity ? null : cap}
        unlimited={cap === Infinity}
      />
    </div>
  );
}
