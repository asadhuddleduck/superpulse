import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth";
import { getLocationsForTenant } from "@/lib/queries/locations";
import { resolveSeatCap } from "@/lib/seats";
import LocationsManager from "@/components/LocationsManager";
import { OnboardingShell } from "@/components/ui/OnboardingShell";
import { OnboardingProgress } from "@/components/ui/OnboardingProgress";
import { PageHeading } from "@/components/ui/PageHeading";
import { FadeIn } from "@/components/ui/FadeIn";
import { ContinueToBudget } from "./continue-to-budget";

export const metadata: Metadata = {
  title: "Add Your Locations | SuperPulse",
};

export const dynamic = "force-dynamic";

export default async function OnboardingLocationsPage() {
  // Impersonation-aware: during "view as client" this reads the client's tenant.
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/login");
  if (tenant.provisioningStatus !== "pending_locations") redirect("/dashboard");

  const [locations, cap] = await Promise.all([
    getLocationsForTenant(tenant.id),
    resolveSeatCap(tenant),
  ]);

  return (
    <OnboardingShell maxWidth="2xl">
      <FadeIn>
        <OnboardingProgress step="locations" />
        <PageHeading
          title="Add your locations"
          subtitle={
            <>
              Add every location SuperPulse should boost to. Each one becomes
              its own local ad set. Got a lot? Use &ldquo;Add many at
              once&rdquo;.
            </>
          }
        />
        <div className="mt-8">
          <LocationsManager
            initialLocations={locations}
            paidLocations={cap === Infinity ? null : cap}
            unlimited={cap === Infinity}
          />
        </div>
        <ContinueToBudget />
      </FadeIn>
    </OnboardingShell>
  );
}
