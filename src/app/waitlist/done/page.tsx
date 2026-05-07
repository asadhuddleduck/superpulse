"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WaitlistHeader from "@/components/waitlist/Header";
import WaitlistFooter from "@/components/waitlist/Footer";
import ConvergenceBackground from "@/components/waitlist/ConvergenceBackground";

function DoneInner() {
  const params = useSearchParams();
  const skipped = params.get("skipped") === "1";
  const upsell = params.get("upsell") === "1";

  let title: string;
  let body: string;
  if (skipped) {
    title = "You’re on the list.";
    body =
      "We’ll be in touch from SuperPulse before the public launch. If your business looks like a strong fit, expect a call from the team to set up a personal demo.";
  } else if (upsell) {
    title = "Loom + audit booked.";
    body =
      "Both your audit PDF and your personal Loom walkthrough will land in your inbox within 24 hours. We’ll also be in touch about your SuperPulse waitlist spot.";
  } else {
    title = "Audit booked.";
    body =
      "Your audit PDF will land in your inbox within 24 hours. We’ll also be in touch about your SuperPulse waitlist spot.";
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
