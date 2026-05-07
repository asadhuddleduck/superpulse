"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WaitlistHeader from "@/components/waitlist/Header";
import WaitlistFooter from "@/components/waitlist/Footer";
import ConvergenceBackground from "@/components/waitlist/ConvergenceBackground";

function UpsellInner() {
  const params = useSearchParams();
  const sessionId = params.get("session_id") ?? "";
  const email = params.get("email") ?? "";
  const name = params.get("name") ?? "";
  const ig = params.get("ig") ?? "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Block direct access — must come from a successful £27 checkout.
  useEffect(() => {
    if (typeof window !== "undefined" && !sessionId) {
      window.location.href = "/waitlist/done?skipped=1";
    }
  }, [sessionId]);

  async function handleBuy() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/audit-97", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          instagram_handle: ig,
          parent_session_id: sessionId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Could not start checkout.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <WaitlistHeader />
      <ConvergenceBackground />

      <main>
        <section className="wl-hero">
          <span className="wl-hero-eyebrow">
            <span className="wl-hero-eyebrow-dot" />
            Payment received · Audit queued
          </span>
          <h1 className="wl-hero-headline">
            One last thing —{" "}
            <span className="wl-hero-headline-accent">make it personal?</span>
          </h1>
          <p className="wl-hero-sub">
            Your audit&rsquo;s already in our queue. Want one of the team to
            record a 5-7 min Loom walking you through every finding, in plain
            English, for your business specifically? Most owners say this is the
            bit that finally makes it click.
          </p>

          <div className="wl-card">
            <div className="wl-card-label">
              <span className="wl-card-label-dot" />
              Personal Loom · +£97 on top of your audit
            </div>
            <h2 className="wl-card-heading">Get a Loom walkthrough on top</h2>
            <p className="wl-card-sub">
              A real human from our team — not a bot — records a walkthrough of
              your audit so you actually understand what to do next:
            </p>

            <ul className="wl-bullets">
              <li>5-7 minute personalised Loom from the team</li>
              <li>Walks you through your top 3 boost candidates, on-screen</li>
              <li>Shows you where most of your local follower growth is being left on the table</li>
              <li>Concrete next 30 days plan — even if you never use SuperPulse</li>
              <li>Yours forever — share it with anyone running your social</li>
            </ul>

            {error && <p className="wl-error">{error}</p>}

            <button onClick={handleBuy} disabled={loading} className="wl-btn">
              {loading ? "Opening Stripe…" : "Yes — add the Loom · £97"}
            </button>

            <p className="wl-fine">
              £97 added on top of your £27 audit. Loom delivered alongside the
              audit PDF within 24h. Refundable if we miss the window.
            </p>

            <p className="wl-skip">
              <a href={`/waitlist/done?session_id=${sessionId}`} className="wl-skip-link">
                No thanks — just send me the £27 audit
              </a>
            </p>
          </div>
        </section>
      </main>

      <WaitlistFooter />
    </>
  );
}

export default function UpsellPage() {
  return (
    <Suspense fallback={null}>
      <UpsellInner />
    </Suspense>
  );
}
