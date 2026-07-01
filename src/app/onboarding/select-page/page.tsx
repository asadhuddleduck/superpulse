import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth";
import { fetchPagesWithIG } from "@/lib/facebook";
import { OnboardingShell } from "@/components/ui/OnboardingShell";
import { OnboardingProgress } from "@/components/ui/OnboardingProgress";
import { PageHeading } from "@/components/ui/PageHeading";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { SelectPageForm, AutoSelectPage } from "./select-page-form";

export const metadata: Metadata = {
  title: "Choose Your Page | SuperPulse",
};

export const dynamic = "force-dynamic";

export default async function SelectPagePage() {
  // Impersonation-aware: during "view as client" this resolves the client's
  // tenant (matching the dashboard layout that redirects here), so operators can
  // read this onboarding step instead of being bounced to /login. The mutating
  // submit route stays blocked by impersonationGuard().
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/login");

  if (tenant.status !== "pending_page_selection") {
    redirect("/dashboard");
  }

  const token = tenant.metaAccessToken;
  if (!token) redirect("/login");

  const pages = await fetchPagesWithIG(token);
  const pagesWithIG = pages.filter((p) => p.instagram_business_account);

  if (pagesWithIG.length === 0) {
    return (
      <OnboardingShell center maxWidth="xl">
        <FadeIn className="w-full text-center">
          <p className="leading-relaxed text-mist">
            We couldn&apos;t find an Instagram Business Account linked to any of your Facebook Pages.
            Connect one in Meta Business Suite, then come back and log in again.
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

  if (pagesWithIG.length === 1) {
    // One Page+IG: nothing to choose. Auto-submit via the guarded POST handler
    // (client component) instead of redirecting to a GET write, which was
    // CSRF-able and skipped impersonationGuard.
    return <AutoSelectPage pageId={pagesWithIG[0].id} />;
  }

  const choices = pagesWithIG.map((p) => ({
    pageId: p.id,
    pageName: p.name,
    igUserId: p.instagram_business_account!.id,
  }));

  return (
    <OnboardingShell center maxWidth="xl">
      <FadeIn className="w-full">
        <OnboardingProgress step="account" />

        <PageHeading
          align="center"
          title="Choose your Page"
          subtitle={`You manage ${choices.length} Pages with Instagram. Pick the one SuperPulse should boost from.`}
        />

        <div className="mt-8">
          <SelectPageForm choices={choices} />
        </div>

        <p className="mt-6 text-center text-xs text-mist">
          You can switch later in Settings.
        </p>
      </FadeIn>
    </OnboardingShell>
  );
}
