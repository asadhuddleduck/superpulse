"use client";

import { useState, useEffect, useRef } from "react";
import WaitlistHeader from "@/components/waitlist/Header";
import WaitlistFooter from "@/components/waitlist/Footer";
import ConvergenceBackground from "@/components/waitlist/ConvergenceBackground";
import SocialProof from "@/components/waitlist/SocialProof";
import { trackPixel, getOrCreateEventId } from "@/lib/meta-pixel-client";
import { BUSINESS_TYPES } from "@/lib/business-types";

const LEAD_KEY = "wl-lead";
const STATE_KEY = "wl-qualify-state";

type Lead = { email: string; firstName: string; ig: string };
type State = {
  businessType: string;
  locations: string;
  hasInstagram: boolean;
  postsActively: boolean;
  hasBusinessManager: boolean;
  hasRunAds: boolean;
};

const initialState: State = {
  businessType: BUSINESS_TYPES[0],
  locations: "1",
  hasInstagram: false,
  postsActively: false,
  hasBusinessManager: false,
  hasRunAds: false,
};

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

function readState(): State {
  if (typeof sessionStorage === "undefined") return initialState;
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (!raw) return initialState;
    return { ...initialState, ...JSON.parse(raw) } as State;
  } catch {
    return initialState;
  }
}

function persistState(state: State): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export default function QualifyPage() {
  const [lead, setLead] = useState<Lead | null>(null);
  const [state, setState] = useState<State>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let found = readLead();
    // Fallback for arrivals from an email CTA (no sessionStorage yet): seed the
    // lead from ?email=&name=&ig= query params so the audit flow works.
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
    setState(readState());
    setHydrated(true);
  }, []);

  function update<K extends keyof State>(key: K, value: State[K]) {
    setState((prev) => {
      const next = { ...prev, [key]: value };
      persistState(next);
      return next;
    });
  }

  async function submit() {
    if (!lead) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const eventId = getOrCreateEventId("registration");
      const res = await fetch("/api/qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: lead.email,
          business_type: state.businessType,
          locations_count: Number(state.locations),
          has_instagram: state.hasInstagram,
          posts_actively: state.postsActively,
          has_business_manager: state.hasBusinessManager,
          has_run_ads: state.hasRunAds,
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
      trackPixel("CompleteRegistration", { event_id: eventId });
      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }
      window.location.href = "/waitlist/offer";
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
            You&rsquo;re on the list{lead.firstName ? `, ${lead.firstName}` : ""}
          </span>
          <h1 className="wl-hero-headline">
            Four quick questions.{" "}
            <span className="wl-hero-headline-accent">Helps us move you up the list.</span>
          </h1>
          <p className="wl-hero-sub">
            We onboard a small number of local businesses at a time. Answer four
            quick things and we&rsquo;ll prioritise you ahead of cold signups.
            Takes about 30 seconds.
          </p>

          <div className="wl-card">
            <div className="wl-card-label">
              <span className="wl-card-label-dot" />
              Quick qualifier · 30 seconds
            </div>

            <div className="wl-field">
              <label htmlFor="q-business-type" className="wl-label">What kind of business?</label>
              <select
                id="q-business-type"
                value={state.businessType}
                onChange={(e) => update("businessType", e.target.value)}
                className="wl-input wl-select"
              >
                {BUSINESS_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="wl-field">
              <label htmlFor="q-locations" className="wl-label">How many locations?</label>
              <input
                id="q-locations"
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                value={state.locations}
                onChange={(e) => update("locations", e.target.value)}
                required
                className="wl-input"
              />
            </div>

            <div className="wl-tick-group">
              <label className="wl-tick">
                <input
                  type="checkbox"
                  checked={state.hasInstagram}
                  onChange={(e) => update("hasInstagram", e.target.checked)}
                />
                <span>I already have an Instagram business profile set up</span>
              </label>
              <label className="wl-tick">
                <input
                  type="checkbox"
                  checked={state.postsActively}
                  onChange={(e) => update("postsActively", e.target.checked)}
                />
                <span>We post on Instagram at least once a week</span>
              </label>
              <label className="wl-tick">
                <input
                  type="checkbox"
                  checked={state.hasBusinessManager}
                  onChange={(e) => update("hasBusinessManager", e.target.checked)}
                />
                <span>I have a Meta Business Manager set up (or could set one up)</span>
              </label>
              <label className="wl-tick">
                <input
                  type="checkbox"
                  checked={state.hasRunAds}
                  onChange={(e) => update("hasRunAds", e.target.checked)}
                />
                <span>We&rsquo;ve run paid ads on Meta before</span>
              </label>
            </div>

            {error && <p className="wl-error">{error}</p>}

            <button
              type="button"
              onClick={() => submit()}
              disabled={loading}
              className="wl-btn"
            >
              {loading ? "One sec…" : "Submit my answers"}
            </button>

            <p className="wl-fine">
              Takes about 30 seconds. You&rsquo;re on the waitlist either way.
            </p>
          </div>
        </section>

        <SocialProof />
      </main>

      <WaitlistFooter />
    </>
  );
}
