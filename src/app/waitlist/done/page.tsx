"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import WaitlistHeader from "@/components/waitlist/Header";
import WaitlistFooter from "@/components/waitlist/Footer";
import ConvergenceBackground from "@/components/waitlist/ConvergenceBackground";
import { trackPixel } from "@/lib/meta-pixel-client";

const PURCHASE_FIRED_PREFIX = "wl-purchase-97-fired:";

function DoneInner() {
  const params = useSearchParams();
  const skipped = params.get("skipped") === "1";
  const upsell = params.get("upsell") === "1";
  const pi = params.get("pi") ?? "";
  const cs = params.get("cs") ?? "";
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (!upsell) return;
    const eventId = pi || cs;
    if (!eventId) return;
    const firedKey = PURCHASE_FIRED_PREFIX + eventId;
    let alreadyFired = false;
    try {
      alreadyFired = localStorage.getItem(firedKey) === "1";
    } catch {
      /* ignore */
    }
    if (alreadyFired) {
      firedRef.current = true;
      return;
    }
    trackPixel("Purchase", {
      value: 97,
      currency: "GBP",
      content_name: "audit-97",
      event_id: eventId,
    });
    try {
      localStorage.setItem(firedKey, "1");
    } catch {
      /* ignore */
    }
    firedRef.current = true;
  }, [upsell, pi, cs]);

  let title: string;
  let body: string;
  if (skipped) {
    title = "You’re on the list.";
    body =
      "We’ll be in touch from SuperPulse before we open to the public. If your business looks like a strong fit, expect a call from one of us to set up a short personal demo.";
  } else if (upsell) {
    title = "Loom and audit booked.";
    body =
      "Your audit PDF and your personal Loom video both land in your inbox inside 24 hours. We’ll also be in touch about your SuperPulse spot on the waitlist.";
  } else {
    title = "Audit booked.";
    body =
      "Your audit PDF lands in your inbox inside 24 hours. We’ll also be in touch about your SuperPulse spot on the waitlist.";
  }

  return (
    <>
      <WaitlistHeader />
      <ConvergenceBackground />

      <main>
        <section className="wl-hero">
          <div className="wl-card wl-card-narrow">
            <div className="wl-success">
              <div className="wl-success-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="wl-success-title">{title}</h2>
              <p className="wl-success-text">{body}</p>
            </div>
          </div>
        </section>
      </main>

      <WaitlistFooter />
    </>
  );
}

export default function DonePage() {
  return (
    <Suspense fallback={null}>
      <DoneInner />
    </Suspense>
  );
}
