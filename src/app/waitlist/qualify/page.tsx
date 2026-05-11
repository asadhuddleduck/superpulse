"use client";

import { useState, Suspense, type FormEvent, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import WaitlistHeader from "@/components/waitlist/Header";
import WaitlistFooter from "@/components/waitlist/Footer";
import ConvergenceBackground from "@/components/waitlist/ConvergenceBackground";
import { trackPixel } from "@/lib/meta-pixel-client";

const BUSINESS_TYPES = [
  "Restaurant, takeaway or cafe",
  "Barbers or hairdressers",
  "Beauty, nails or aesthetics",
  "Dentist or orthodontist",
  "Gym or fitness studio",
  "Optician or other clinic",
  "Other local business",
];

function QualifyInner() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const name = params.get("name") ?? "";
  const ig = params.get("ig") ?? "";

  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0]);
  const [locations, setLocations] = useState("1");
  const [hasInstagram, setHasInstagram] = useState(false);
  const [postsActively, setPostsActively] = useState(false);
  const [hasBusinessManager, setHasBusinessManager] = useState(false);
  const [hasRunAds, setHasRunAds] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && !email) {
      window.location.href = "/waitlist";
    }
  }, [email]);

  async function submit(choice: "yes" | "no") {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const eventId = crypto.randomUUID();
      const res = await fetch("/api/qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          instagram_handle: ig,
          business_type: businessType,
          locations_count: Number(locations),
          has_instagram: hasInstagram,
          posts_actively: postsActively,
          has_business_manager: hasBusinessManager,
          has_run_ads: hasRunAds,
          audit_offer_choice: choice,
          event_id: eventId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again.");
        return;
      }
      trackPixel("CompleteRegistration", { event_id: eventId });
      if (choice === "yes") {
        trackPixel("InitiateCheckout", { value: 27, currency: "GBP" });
      }
      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }
      window.location.href = "/waitlist/done";
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleAuditYes(e: FormEvent) {
    e.preventDefault();
    submit("yes");
  }

  return (
    <>
      <WaitlistHeader />
      <ConvergenceBackground />

      <main>
        <section className="wl-hero">
          <span className="wl-hero-eyebrow">
            <span className="wl-hero-eyebrow-dot" />
            You&rsquo;re on the list{name ? `, ${name}` : ""}
          </span>
          <h1 className="wl-hero-headline">
            Four quick questions.{" "}
            <span className="wl-hero-headline-accent">Helps us speed your spot up.</span>
          </h1>
          <p className="wl-hero-sub">
            We onboard a small number of local businesses at a time. Answer four
            quick things and we&rsquo;ll prioritise you ahead of cold signups.
            Takes about 30 seconds.
          </p>

          <form onSubmit={handleAuditYes} className="wl-card">
            <div className="wl-card-label">
              <span className="wl-card-label-dot" />
              Quick qualifier · 30 seconds
            </div>

            <div className="wl-field">
              <label htmlFor="q-business-type" className="wl-label">What kind of business?</label>
              <select
                id="q-business-type"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
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
                value={locations}
                onChange={(e) => setLocations(e.target.value)}
                required
                className="wl-input"
              />
            </div>

            <div className="wl-tick-group">
              <label className="wl-tick">
                <input
                  type="checkbox"
                  checked={hasInstagram}
                  onChange={(e) => setHasInstagram(e.target.checked)}
                />
                <span>I already have an Instagram business profile set up</span>
              </label>
              <label className="wl-tick">
                <input
                  type="checkbox"
                  checked={postsActively}
                  onChange={(e) => setPostsActively(e.target.checked)}
                />
                <span>We post on Instagram at least once a week</span>
              </label>
              <label className="wl-tick">
                <input
                  type="checkbox"
                  checked={hasBusinessManager}
                  onChange={(e) => setHasBusinessManager(e.target.checked)}
                />
                <span>I have a Meta Business Manager set up (or could set one up)</span>
              </label>
              <label className="wl-tick">
                <input
                  type="checkbox"
                  checked={hasRunAds}
                  onChange={(e) => setHasRunAds(e.target.checked)}
                />
                <span>We&rsquo;ve run paid ads on Meta before</span>
              </label>
            </div>

            <div className="wl-offer">
              <div className="wl-card-label">
                <span className="wl-card-label-dot" />
                Want to jump the queue? £27 audit · Inbox in 24h
              </div>
              <h2 className="wl-card-heading">Audit your Instagram while you wait</h2>
              <p className="wl-card-sub">
                One of the team sits down with{ig ? <> @{ig}</> : " your Instagram"} and writes
                you a short, plain-English PDF: the 3 posts to put money behind first, why
                locals near you will walk in for them, and a 30-day plan even if you never
                use SuperPulse.
              </p>
              <ul className="wl-bullets">
                <li>3 posts to boost first, and why</li>
                <li>How your rhythm compares to fast-growing local businesses</li>
                <li>5 caption + hook fixes for your next 5 posts</li>
                <li>Money back if we miss the 24h window</li>
              </ul>

              {error && <p className="wl-error">{error}</p>}

              <button type="submit" disabled={loading} className="wl-btn">
                {loading ? "One sec…" : "Yes, send me the £27 audit"}
              </button>

              <p className="wl-fine">
                Secure checkout through Stripe. You&rsquo;ll be on the waitlist either way.
              </p>

              <p className="wl-skip">
                <button
                  type="button"
                  onClick={() => submit("no")}
                  disabled={loading}
                  className="wl-skip-link wl-skip-link-button"
                >
                  No thanks, just keep my spot on the waitlist
                </button>
              </p>
            </div>
          </form>
        </section>
      </main>

      <WaitlistFooter />
    </>
  );
}

export default function QualifyPage() {
  return (
    <Suspense fallback={null}>
      <QualifyInner />
    </Suspense>
  );
}
