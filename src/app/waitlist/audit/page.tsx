"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WaitlistHeader from "@/components/waitlist/Header";
import WaitlistFooter from "@/components/waitlist/Footer";
import ConvergenceBackground from "@/components/waitlist/ConvergenceBackground";

function AuditInner() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const name = params.get("name") ?? "";
  const ig = params.get("ig") ?? "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the visitor lands here without an email, send them back to the waitlist.
  useEffect(() => {
    if (typeof window !== "undefined" && !email) {
      window.location.href = "/waitlist";
    }
  }, [email]);

  async function handleBuy() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/audit-27", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, instagram_handle: ig }),
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
            You&rsquo;re on the list, {name || "friend"}
          </span>
          <h1 className="wl-hero-headline">
            Want to{" "}
            <span className="wl-hero-headline-accent">jump the queue?</span>
          </h1>
          <p className="wl-hero-sub">
            While you wait, one of our team will go through {ig ? <>@{ig}</> : "your Instagram"}{" "}
            by hand and send you a proper profile audit, written for your business.
            Back in your inbox inside 24 hours.
          </p>

          <div className="wl-card">
            <div className="wl-card-label">
              <span className="wl-card-label-dot" />
              Audit · £27 · In your inbox inside 24h
            </div>
            <h2 className="wl-card-heading">Your Instagram profile audit</h2>
            <p className="wl-card-sub">
              One of our team sits down with your last 50 posts, looks at them the
              way a paying local would, and sends you a short PDF covering:
            </p>

            <ul className="wl-bullets">
              <li>The 3 posts on your grid we&rsquo;d put money behind first</li>
              <li>Why those are the ones locals near you will actually walk in for</li>
              <li>How your posting rhythm compares to local businesses growing fastest right now</li>
              <li>A rough read on how many extra profile visits a month SuperPulse would put your way</li>
              <li>Plain-English fixes for the captions and hooks on your next 5 posts</li>
            </ul>

            {error && <p className="wl-error">{error}</p>}

            <button onClick={handleBuy} disabled={loading || !email} className="wl-btn">
              {loading ? "Opening Stripe…" : "Send me my audit · £27"}
            </button>

            <p className="wl-fine">
              Secure checkout through Stripe. If we miss the 24 hour window, you
              get your money back.
            </p>

            <p className="wl-skip">
              <a href="/waitlist/done?skipped=1" className="wl-skip-link">
                No thanks, I&rsquo;ll wait for the public launch
              </a>
            </p>
          </div>
        </section>
      </main>

      <WaitlistFooter />
    </>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={null}>
      <AuditInner />
    </Suspense>
  );
}
