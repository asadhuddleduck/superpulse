"use client";

import { useState, useEffect, useRef } from "react";
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

export default function DemoPage() {
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
      const eventId = choice === "yes" ? getOrCreateEventId("schedule") : undefined;
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: lead.email,
          choice,
          event_id: eventId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.redirect) {
          window.location.href = data.redirect;
          return;
        }
        setError(data.error || "Something went wrong. Try again.");
        submittingRef.current = false;
        setLoading(false);
        return;
      }
      if (choice === "yes" && eventId && data.first) {
        trackPixel("Schedule", { event_id: eventId });
      }
      window.location.href = data.redirect || "/waitlist/offer";
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
            Multi-location businesses skip the queue
          </span>
          <h1 className="wl-hero-headline">
            You can skip the queue.{" "}
            <span className="wl-hero-headline-accent">
              We&rsquo;d like to show you SuperPulse one to one.
            </span>
          </h1>
          <p className="wl-hero-sub">
            Most people on the waitlist hear from us when we open up. Businesses
            with 3 or more locations are the ones we onboard first, so we do
            this differently. One of the team will walk you through SuperPulse
            on a short call, set up around your locations, and answer whatever
            you want to ask.
          </p>

          <div className="wl-card">
            <div className="wl-card-label">
              <span className="wl-card-label-dot" />
              One to one demo · Free · No card needed
            </div>
            <h2 className="wl-card-heading">Want one of the team to show you round?</h2>
            <p className="wl-card-sub">
              Say yes and someone will be in touch within the next few hours.
              The demo takes 15 to 20 minutes on a call. We look at your
              Instagram together and show you exactly how SuperPulse would run
              across your locations.
            </p>

            <ul className="wl-bullets">
              <li>A real person from our team, on a call, looking at your account with you</li>
              <li>How boosting works across every location you run</li>
              <li>What it costs and what you get, all answered on the call</li>
              <li>If it fits, we set you up ahead of the queue</li>
            </ul>

            {error && <p className="wl-error">{error}</p>}

            <button
              type="button"
              onClick={() => submit("yes")}
              disabled={loading}
              className="wl-btn"
            >
              {loading ? "One sec…" : "Yes, book my demo"}
            </button>

            <p className="wl-fine">
              Free, and your card is never asked for. Someone from our team will
              be in touch within the next few hours, usually by phone or
              WhatsApp.
            </p>

            <p className="wl-skip">
              <button
                type="button"
                onClick={() => submit("no")}
                disabled={loading}
                className="wl-skip-link wl-skip-link-button"
              >
                No thanks, keep my spot on the waitlist
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
