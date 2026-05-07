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

  // Block direct access. Must come from a successful £27 checkout.
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
            One last thing.{" "}
            <span className="wl-hero-headline-accent">Want it walked through?</span>
          </h1>
          <p className="wl-hero-sub">
            Your audit is already in the queue. Want one of the team to record a
            5 to 7 minute Loom video, sat looking at your account, walking you
            through every finding in plain English? Most owners say this is the
            bit that finally makes it click.
          </p>

          <div className="wl-card">
            <div className="wl-card-label">
              <span className="wl-card-label-dot" />
              Personal Loom · +£97 on top of your audit
            </div>
            <h2 className="wl-card-heading">Get the Loom walkthrough too</h2>
            <p className="wl-card-sub">
              A real human on our side, not a bot, records a personal video so
              you actually know what to do next, in your own words:
            </p>

            <ul className="wl-bullets">
              <li>5 to 7 minute personal Loom, recorded for you by name</li>
              <li>Walks through your top 3 posts to put money behind, on screen</li>
              <li>Points out where you&rsquo;re leaving the most local follower growth on the table</li>
              <li>A concrete plan for your next 30 days, even if you never use SuperPulse</li>
              <li>Yours to keep, share it with whoever runs your social</li>
            </ul>

            {error && <p className="wl-error">{error}</p>}

            <button onClick={handleBuy} disabled={loading} className="wl-btn">
              {loading ? "Opening Stripe…" : "Yes, add the Loom · £97"}
            </button>

            <p className="wl-fine">
              £97 on top of your £27 audit. Loom lands with your audit PDF inside
              24 hours. If we miss the window, you get your money back.
            </p>

            <p className="wl-skip">
              <a href={`/waitlist/done?session_id=${sessionId}`} className="wl-skip-link">
                No thanks, just send the £27 audit
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
