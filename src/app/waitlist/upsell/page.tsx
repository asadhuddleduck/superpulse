"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WaitlistHeader from "@/components/waitlist/Header";
import WaitlistFooter from "@/components/waitlist/Footer";
import ConvergenceBackground from "@/components/waitlist/ConvergenceBackground";
import { trackPixel } from "@/lib/meta-pixel-client";

const PURCHASE_FIRED_PREFIX = "wl-purchase-27-fired:";

function UpsellInner() {
  const params = useSearchParams();
  const sessionId = params.get("session_id") ?? "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sessionId) {
      window.location.replace("/waitlist/done?skipped=1");
      return;
    }
    const firedKey = PURCHASE_FIRED_PREFIX + sessionId;
    let alreadyFired = false;
    try {
      alreadyFired = localStorage.getItem(firedKey) === "1";
    } catch {
      /* ignore */
    }
    if (!alreadyFired) {
      trackPixel("Purchase", {
        value: 27,
        currency: "GBP",
        content_name: "audit-27",
        event_id: sessionId,
      });
      try {
        localStorage.setItem(firedKey, "1");
      } catch {
        /* ignore */
      }
    }
  }, [sessionId]);

  async function handleBuy() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/upsell/charge-97", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_session_id: sessionId }),
      });
      const data = await res.json();
      if (!res.ok || !data.redirect) {
        setError(data.error || "Could not complete the charge. Try again.");
        submittingRef.current = false;
        setLoading(false);
        return;
      }
      window.location.href = data.redirect;
    } catch {
      setError("Network error. Try again.");
      submittingRef.current = false;
      setLoading(false);
    }
  }

  if (!sessionId) return null;

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
              A real person on our side records a personal video so you actually
              know what to do next, in your own words:
            </p>

            <ul className="wl-bullets">
              <li>5 to 7 minute personal Loom, recorded for you by name</li>
              <li>Walks through your top 3 posts to put money behind, on screen</li>
              <li>Points out where you&rsquo;re leaving the most local follower growth on the table</li>
              <li>A concrete plan for your next 30 days, even if you never use SuperPulse</li>
              <li>Yours to keep, share it with whoever runs your social</li>
            </ul>

            {error && <p className="wl-error">{error}</p>}

            <button type="button" onClick={handleBuy} disabled={loading} className="wl-btn">
              {loading ? "Charging your card…" : "Yes, add the Loom · £97"}
            </button>

            <p className="wl-fine">
              £97 charged to the card you just used. Loom lands with your audit
              PDF inside 24 hours. If we miss the window, you get your money
              back.
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
