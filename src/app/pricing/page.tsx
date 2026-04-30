import type { Metadata } from "next";
import Link from "next/link";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing — SuperPulse",
  description:
    "Single tier — £300 per month plus VAT. Boost every Instagram post you've already made into a local ad that runs forever.",
};

export default function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string }>;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            <span className="text-viridian">Super</span>
            <span className="text-sandstorm">Pulse</span>
          </Link>
          <a
            href="/api/auth/logout"
            className="text-sm text-zinc-500 hover:text-white transition-colors"
          >
            Sign out
          </a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <PastDueBanner searchParams={searchParams} />

        <h1 className="text-3xl sm:text-4xl font-bold mb-3">
          One simple plan.
        </h1>
        <p className="text-zinc-400 mb-10">
          Auto-boosts every post you make on Instagram. Multi-location, daily AI scoring, and a finger-on-the-pulse dashboard.
        </p>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-5xl font-bold">£300</span>
            <span className="text-zinc-400">/ month</span>
          </div>
          <p className="text-sm text-zinc-500 mb-6">+ VAT for UK businesses</p>

          <ul className="space-y-3 mb-8 text-sm text-zinc-300">
            <Bullet>AI-driven Instagram boost automation, 24/7</Bullet>
            <Bullet>Multi-location targeting with radius control</Bullet>
            <Bullet>Daily scoring + auto-launch (no clicks needed)</Bullet>
            <Bullet>Real-time dashboard — last scan, posts boosted, spend, performance</Bullet>
            <Bullet>Email when your first boosts go live</Bullet>
            <Bullet>Cancel anytime — no contracts</Bullet>
          </ul>

          <PricingClient />

          <p className="text-xs text-zinc-500 text-center mt-4">
            Have a code? Use{" "}
            <span className="font-mono text-zinc-300">FIRSTMONTHFREE</span> to
            zero out your first month.
          </p>
        </div>

        <div className="mt-10 text-sm text-zinc-400 space-y-3">
          <p>
            <strong className="text-zinc-200">Need help connecting Facebook?</strong>{" "}
            <Link
              href="/onboarding/support"
              className="text-viridian hover:underline"
            >
              See onboarding support →
            </Link>
          </p>
          <p>
            Existing client? Use the same checkout — your tenant will be linked
            automatically.
          </p>
        </div>
      </main>
    </div>
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
    <div className="mb-8 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-200">
      Your last payment failed. Re-enter card details below to keep your boosts
      running.
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <svg
        className="h-5 w-5 text-viridian shrink-0 mt-0.5"
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
