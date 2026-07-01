import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth";
import { fetchAdAccounts } from "@/lib/facebook";
import { OnboardingShell } from "@/components/ui/OnboardingShell";
import { OnboardingProgress } from "@/components/ui/OnboardingProgress";
import { PageHeading } from "@/components/ui/PageHeading";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { SelectAdAccountForm } from "./select-ad-account-form";

export const metadata: Metadata = {
  title: "Choose Your Ad Account | SuperPulse",
};

export const dynamic = "force-dynamic";

export default async function SelectAdAccountPage() {
  // Impersonation-aware: during "view as client" this resolves the client's
  // tenant (matching the dashboard layout that redirects here), so operators can
  // read this onboarding step instead of being bounced to /login. The mutating
  // submit route stays blocked by impersonationGuard().
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/login");

  if (tenant.status !== "pending_ad_account") {
    redirect("/dashboard");
  }

  const token = tenant.metaAccessToken;
  if (!token) redirect("/login");

  const all = await fetchAdAccounts(token);

  // Hide non-spendable accounts (status != 1 ACTIVE). The note below the list
  // explains why an expected account might be missing so users don't have to
  // ask support.
  const eligible = all
    .filter((a) => a.account_status === 1)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (eligible.length === 0) {
    return (
      <OnboardingShell center maxWidth="xl">
        <FadeIn className="w-full text-center">
          <p className="leading-relaxed text-mist">
            We couldn&apos;t find any active ad accounts on your Meta login.
            Set up an ad account in Meta Business Suite (with billing
            settled), then come back and log in again.
          </p>
          <div className="mt-6">
            <Button href="/login" variant="secondary">
              Back to login
            </Button>
          </div>
        </FadeIn>
      </OnboardingShell>
    );
  }

  const choices = eligible.map((a) => {
    const rawId = a.id.startsWith("act_") ? a.id.slice(4) : a.id;
    return {
      adAccountId: rawId,
      name: a.name,
      currency: a.currency,
    };
  });

  return (
    <OnboardingShell center maxWidth="xl">
      <FadeIn className="w-full">
        <OnboardingProgress step="account" />

        <PageHeading
          align="center"
          title="Choose your ad account"
          subtitle="Pick the ad account SuperPulse should use for your boosts. Spend and billing happen on this account."
        />

        <div className="mt-8">
          <SelectAdAccountForm choices={choices} />
        </div>

        <p className="mt-6 text-xs leading-relaxed text-mist">
          <span className="text-white">Don&apos;t see an account?</span>{" "}
          We only show accounts that are ACTIVE and spendable. Closed,
          disabled, unsettled, or in-grace-period accounts are hidden. Fix
          billing or restore access in Meta Business Suite, then log in again.
        </p>
      </FadeIn>
    </OnboardingShell>
  );
}
