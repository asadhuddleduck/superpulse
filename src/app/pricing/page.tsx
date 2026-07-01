import type { Metadata } from "next";
import Link from "next/link";
import PricingClient from "./PricingClient";
import { OnboardingShell } from "@/components/ui/OnboardingShell";
import { PageHeading } from "@/components/ui/PageHeading";
import { Card } from "@/components/ui/Card";
import { FadeIn } from "@/components/ui/FadeIn";

export const metadata: Metadata = {
  title: "Pricing | SuperPulse",
  description:
    "£27 per location per month plus VAT. Boost every Instagram post you've already made into a local ad that runs forever.",
};

export default function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string }>;
}) {
  return (
    <OnboardingShell
      maxWidth="2xl"
      headerRight={
        <a
          href="/api/auth/logout"
          className="text-mist transition-colors hover:text-white"
        >
          Sign out
        </a>
      }
    >
      <FadeIn>
        <Card variant="accent" className="mb-8 text-sm text-mist">
          <strong className="text-sandstorm">
            SuperPulse is waitlist only right now.
          </strong>{" "}
          You can subscribe today, but a paid account still joins the waitlist.
          We bring accounts live in order and email you when yours is switched
          on. Not ready to subscribe?{" "}
          <Link href="/waitlist" className="text-viridian hover:underline">
            Join the free waitlist
          </Link>
          .
        </Card>

        <PastDueBanner searchParams={searchParams} />

        <PageHeading
          title="One simple plan."
          subtitle="£27 per location, per month. Auto-boosts every post you make on Instagram, with daily scoring and a finger-on-the-pulse dashboard."
          className="mb-10"
        />

        <Card className="p-6 sm:p-8">
          <ul className="mb-8 space-y-3 text-sm text-mist">
            <Bullet>AI-driven Instagram boost automation, 24/7</Bullet>
            <Bullet>£27 per location, add or remove locations whenever</Bullet>
            <Bullet>Radius targeting around each location</Bullet>
            <Bullet>Daily scoring + auto-launch (no clicks needed)</Bullet>
            <Bullet>Real-time dashboard: last scan, posts boosted, spend, performance</Bullet>
            <Bullet>Cancel anytime, no contracts</Bullet>
          </ul>

          <PricingClient />

          <p className="mt-4 text-center text-xs text-mist">
            Have a code? Use{" "}
            <span className="font-mono text-white">FIRSTMONTHFREE</span> to zero
            out your first month.
          </p>
        </Card>

        <div className="mt-10 space-y-3 text-sm text-mist">
          <p>
            <strong className="text-white">Need help connecting Facebook?</strong>{" "}
            <Link
              href="/onboarding/support"
              className="text-viridian hover:underline"
            >
              See onboarding support →
            </Link>
          </p>
          <p>
            Existing client? Use the same checkout, your tenant will be linked
            automatically.
          </p>
        </div>
      </FadeIn>
    </OnboardingShell>
  );
}

async function PastDueBanner({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  if (params?.reason !== "past_due") return null;
  return (
    <div className="mb-8 rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-4 text-sm text-red-200">
      Your last payment failed. Re-enter card details below to keep your boosts
      running.
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <svg
        className="h-5 w-5 shrink-0 text-viridian mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.5 12.75l6 6 9-13.5"
        />
      </svg>
      <span>{children}</span>
    </li>
  );
}
