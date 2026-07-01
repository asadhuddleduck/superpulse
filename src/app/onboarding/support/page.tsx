import type { Metadata } from "next";
import Link from "next/link";
import { OnboardingShell } from "@/components/ui/OnboardingShell";
import { PageHeading } from "@/components/ui/PageHeading";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/FadeIn";

export const metadata: Metadata = {
  title: "Onboarding support | SuperPulse",
  description:
    "Stuck connecting Facebook? Three options: free resources, Meta support, or paid handhold.",
};

export default function OnboardingSupportPage() {
  return (
    <OnboardingShell
      maxWidth="3xl"
      headerRight={
        <Link
          href="/onboarding/connect"
          className="text-mist transition hover:text-white"
        >
          ← Back to connect
        </Link>
      }
    >
      <FadeIn>
        <PageHeading
          title="Stuck connecting Facebook?"
          subtitle="Pick the path that fits, we'll get you live."
        />

        <Card className="mt-8 mb-10 text-sm text-mist">
          <strong className="text-white">Heads up:</strong> Ad account access
          is managed by Meta. SuperPulse can&apos;t fix login or Business
          Manager issues directly, but we can point you to the right help, or
          handle it for you.
        </Card>

        <div className="space-y-4">
          {/* Card 1: Free resources */}
          <Card>
            <div className="flex items-start gap-4">
              <div className="shrink-0 h-10 w-10 rounded-lg bg-slate flex items-center justify-center text-mist font-bold">
                1
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold mb-1">Free resources</h2>
                <p className="text-sm text-mist mb-3">
                  Walk-throughs for the most common Business Manager
                  hiccups. Most people are sorted in 10-15 minutes.
                </p>
                <a
                  href="https://www.facebook.com/business/tools/meta-business-suite/get-started"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-viridian hover:underline"
                >
                  Open Meta&apos;s getting-started guide →
                </a>
              </div>
            </div>
          </Card>

          {/* Card 2: Contact Meta support */}
          <Card>
            <div className="flex items-start gap-4">
              <div className="shrink-0 h-10 w-10 rounded-lg bg-slate flex items-center justify-center text-mist font-bold">
                2
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold mb-1">
                  Contact Meta support directly
                </h2>
                <p className="text-sm text-mist mb-3">
                  For account-level issues (suspended ad account, business
                  verification, payment method), Meta has to fix it, they
                  won&apos;t let us touch your account.
                </p>
                <a
                  href="https://business.facebook.com/business/help"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-viridian hover:underline"
                >
                  Open Meta Business Help Center →
                </a>
              </div>
            </div>
          </Card>

          {/* Card 3: Paid handhold */}
          <Card variant="accent">
            <div className="flex items-start gap-4">
              <div className="shrink-0 h-10 w-10 rounded-lg bg-sandstorm/20 flex items-center justify-center text-sandstorm font-bold">
                3
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold mb-1">
                  We&apos;ll do it for you: £90
                </h2>
                <p className="text-sm text-mist mb-1">
                  One of our team gets on a call with you, screen-shares, and
                  gets you fully connected. Usually 30-45 minutes.
                </p>
                <p className="text-xs text-mist mb-4">
                  This is a one-off fee, separate from your monthly
                  subscription. We refund it if we can&apos;t fix it.
                </p>
                <HandholdCheckout />
              </div>
            </div>
          </Card>
        </div>

        <p className="text-sm text-mist mt-10 text-center">
          Already paid?{" "}
          <Link href="/onboarding/connect" className="text-viridian hover:underline">
            Go back to connect →
          </Link>
        </p>
      </FadeIn>
    </OnboardingShell>
  );
}

function HandholdCheckout() {
  // Pure static button that posts to the /api/checkout endpoint with a
  // distinct mode. Using a separate route rather than the recurring one.
  return (
    <form action="/api/checkout/handhold" method="POST">
      <Button type="submit" variant="sandstorm" fullWidth>
        Book the £90 handhold call
      </Button>
    </form>
  );
}
