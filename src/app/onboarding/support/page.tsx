import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Onboarding support — SuperPulse",
  description:
    "Stuck connecting Facebook? Three options: free resources, Meta support, or paid handhold.",
};

export default function OnboardingSupportPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            <span className="text-viridian">Super</span>
            <span className="text-sandstorm">Pulse</span>
          </Link>
          <Link
            href="/onboarding/connect"
            className="text-sm text-zinc-400 hover:text-white transition"
          >
            ← Back to connect
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3">
          Stuck connecting Facebook?
        </h1>
        <p className="text-zinc-400 mb-8">
          Pick the path that fits — we&apos;ll get you live.
        </p>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 mb-10 text-sm text-zinc-300">
          <strong className="text-zinc-200">Heads up:</strong> Ad account access
          is managed by Meta. SuperPulse can&apos;t fix login or Business
          Manager issues directly — but we can point you to the right help, or
          handle it for you.
        </div>

        <div className="space-y-4">
          {/* Card 1: Free resources */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0 h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold">
                1
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold mb-1">Free resources</h2>
                <p className="text-sm text-zinc-400 mb-3">
                  Walk-throughs for the most common Business Manager
                  hiccups. Most people are sorted in 10-15 minutes.
                </p>
                <a
                  href="https://www.facebook.com/business/learn/lessons/get-started-meta-business-suite"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-viridian hover:underline"
                >
                  Open Meta&apos;s onboarding course →
                </a>
              </div>
            </div>
          </div>

          {/* Card 2: Contact Meta support */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0 h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold">
                2
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold mb-1">
                  Contact Meta support directly
                </h2>
                <p className="text-sm text-zinc-400 mb-3">
                  For account-level issues (suspended ad account, business
                  verification, payment method), Meta has to fix it — they
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
          </div>

          {/* Card 3: Paid handhold */}
          <div className="rounded-2xl border border-sandstorm/40 bg-sandstorm/5 p-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0 h-10 w-10 rounded-lg bg-sandstorm/20 flex items-center justify-center text-sandstorm font-bold">
                3
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold mb-1">
                  We&apos;ll do it for you — £90
                </h2>
                <p className="text-sm text-zinc-300 mb-1">
                  One of our team gets on a call with you, screen-shares, and
                  gets you fully connected. Usually 30-45 minutes.
                </p>
                <p className="text-xs text-zinc-500 mb-4">
                  This is a one-off fee, separate from your monthly
                  subscription. We refund it if we can&apos;t fix it.
                </p>
                <HandholdCheckout />
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-zinc-500 mt-10 text-center">
          Already paid?{" "}
          <Link href="/onboarding/connect" className="text-viridian hover:underline">
            Go back to connect →
          </Link>
        </p>
      </main>
    </div>
  );
}

function HandholdCheckout() {
  // Pure static button that posts to the /api/checkout endpoint with a
  // distinct mode. Using a separate route rather than the recurring one.
  return (
    <form action="/api/checkout/handhold" method="POST">
      <button
        type="submit"
        className="rounded-lg bg-sandstorm px-5 py-2.5 text-sm font-semibold text-black hover:bg-sandstorm/90 transition"
      >
        Book the £90 handhold call
      </button>
    </form>
  );
}
