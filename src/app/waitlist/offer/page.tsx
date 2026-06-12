"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WaitlistHeader from "@/components/waitlist/Header";
import WaitlistFooter from "@/components/waitlist/Footer";
import ConvergenceBackground from "@/components/waitlist/ConvergenceBackground";
import SocialProof from "@/components/waitlist/SocialProof";
import { trackPixel, getOrCreateEventId } from "@/lib/meta-pixel-client";

const LEAD_KEY = "wl-lead";

type Lead = { email: string; firstName: string; ig: string };

function readLead(): Lead | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LEAD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Lead>;
    if (!parsed.email) return null;
    return {
      email: String(parsed.email),
      firstName: String(parsed.firstName ?? ""),
      ig: String(parsed.ig ?? ""),
    };
  } catch {
    return null;
  }
}

function OfferInner() {
  const params = useSearchParams();
  const demo = params.get("demo") === "1";
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let found = readLead();
    if (!found) {
      const sp = new URLSearchParams(window.location.search);
      const qEmail = sp.get("email");
      if (qEmail) {
        found = { email: qEmail, firstName: sp.get("name") ?? "", ig: sp.get("ig") ?? "" };
        try {
          sessionStorage.setItem(LEAD_KEY, JSON.stringify(found));
        } catch {
          /* ignore */
        }
      }
    }
    if (!found) {
      window.location.replace("/waitlist");
      return;
    }
    setLead(found);
    setHydrated(true);
  }, []);

  async function submit(choice: "yes" | "no") {
    if (!lead) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const eventId = choice === "yes" ? getOrCreateEventId("checkout") : undefined;
      const res = await fetch("/api/audit-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: lead.email,
          choice,
          demo,
          event_id: eventId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again.");
        submittingRef.current = false;
        setLoading(false);
        return;
      }
      if (choice === "yes" && eventId) {
        trackPixel("InitiateCheckout", { value: 27, currency: "GBP", event_id: eventId });
      }
      window.location.href = data.redirect || "/waitlist/done";
    } catch {
      setError("Network error. Try again.");
      submittingRef.current = false;
      setLoading(false);
    }
  }

  if (!hydrated || !lead) return null;

  return (
    <>
      <WaitlistHeader />
      <ConvergenceBackground />

      <main>
        <section className="wl-hero">
          <span className="wl-hero-eyebrow">
            <span className="wl-hero-eyebrow-dot" />
            {demo
              ? "Demo request received · Our team will be in touch within a few hours"
              : "You're on the waitlist"}
          </span>
          {demo ? (
            <h1 className="wl-hero-headline">
              One thing before your demo.{" "}
              <span className="wl-hero-headline-accent">Want your Instagram reviewed first?</span>
            </h1>
          ) : (
            <h1 className="wl-hero-headline">
              You&rsquo;re on the list.{" "}
              <span className="wl-hero-headline-accent">
                We&rsquo;ll let you know when we can take you on.
              </span>
            </h1>
          )}

          <div className="wl-card">
            <div className="wl-card-label">
              <span className="wl-card-label-dot" />
              {demo
                ? "Upgrade your demo · £27 · Inbox in 24h"
                : "While you wait · £27 review · Inbox in 24h"}
            </div>
            <h2 className="wl-card-heading">
              {demo
                ? "Add a written review of your Instagram"
                : "Want your Instagram reviewed in the meantime?"}
            </h2>
            <p className="wl-card-sub">
              {demo
                ? "Before your demo, one of the team sits down with your Instagram and writes you a short plain English PDF. It lands in your inbox inside 24 hours, so you can read it before we talk and we can go through it together on the call."
                : "We onboard a small number of local businesses at a time, so there may be a short wait. While you're waiting, one of the team can sit down with your Instagram and write you a short plain English PDF on exactly what to fix first."}
            </p>

            <ul className="wl-bullets">
              <li>The 3 posts we&rsquo;d put money behind first, and why</li>
              <li>How your posting compares to fast-growing local businesses</li>
              <li>5 caption and hook fixes for your next 5 posts</li>
              <li>Money back if we miss the 24 hour window</li>
            </ul>

            {error && <p className="wl-error">{error}</p>}

            <button
              type="button"
              onClick={() => submit("yes")}
              disabled={loading}
              className="wl-btn"
            >
              {loading
                ? "One sec…"
                : demo
                  ? "Yes, add the £27 review"
                  : "Yes, send me the £27 review"}
            </button>

            <p className="wl-fine">
              {demo
                ? "Secure checkout through Stripe. Your demo happens either way. Your card is only charged again if you choose to add the £97 Loom walkthrough on the next page."
                : "Secure checkout through Stripe. You keep your spot on the waitlist either way. Your card is only charged again if you choose to add the £97 Loom walkthrough on the next page."}
            </p>

            <p className="wl-skip">
              <button
                type="button"
                onClick={() => submit("no")}
                disabled={loading}
                className="wl-skip-link wl-skip-link-button"
              >
                {demo ? "No thanks, just the demo" : "No thanks, just keep my spot"}
              </button>
            </p>
          </div>
        </section>

        <SocialProof />
      </main>

      <WaitlistFooter />
    </>
  );
}

export default function OfferPage() {
  return (
    <Suspense fallback={null}>
      <OfferInner />
    </Suspense>
  );
}
