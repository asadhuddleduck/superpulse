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
            <span className="wl-hero-headline-accent">skip the queue?</span>
          </h1>
          <p className="wl-hero-sub">
            While you wait, our team will hand-review {ig ? <>@{ig}</> : "your Instagram"}{" "}
            and send you a personalised profile audit. Built by humans + AI in under
            24 hours.
          </p>

          <div className="wl-card">
            <div className="wl-card-label">
              <span className="wl-card-label-dot" />
              Audit · £27 · Delivered in 24h
            </div>
            <h2 className="wl-card-heading">Your IG profile audit</h2>
            <p className="wl-card-sub">
              A senior strategist on our team — paired with our analysis engine —
              rips through your last 50 posts and sends you a PDF that covers:
            </p>

            <ul className="wl-bullets">
              <li>The 3 posts already on your grid that we&rsquo;d boost first</li>
              <li>Why those posts are the ones locals will respond to</li>
              <li>Your posting cadence vs. businesses that are growing fastest</li>
              <li>An estimate of how many extra profile visits SuperPulse would deliver per month for you</li>
              <li>Specific copy + hook fixes for your next 5 posts</li>
            </ul>

            {error && <p className="wl-error">{error}</p>}

            <button onClick={handleBuy} disabled={loading || !email} className="wl-btn">
              {loading ? "Opening Stripe…" : "Get my profile audit · £27"}
            </button>

            <p className="wl-fine">
              Secure checkout via Stripe. Refundable if we miss the 24h window.
            </p>

            <p className="wl-skip">
              <a href="/waitlist/done?skipped=1" className="wl-skip-link">
                No thanks — I&rsquo;ll wait for the public launch
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
