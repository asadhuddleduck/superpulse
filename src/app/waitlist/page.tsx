"use client";

import { useState, useEffect, Suspense, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import WaitlistHeader from "@/components/waitlist/Header";
import WaitlistFooter from "@/components/waitlist/Footer";
import ConvergenceBackground from "@/components/waitlist/ConvergenceBackground";
import SocialProof from "@/components/waitlist/SocialProof";
import CaseStudies from "@/components/waitlist/CaseStudies";
import WaitlistLogoStrip from "@/components/waitlist/LogoStrip";
import { trackPixel } from "@/lib/meta-pixel-client";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
type UtmKey = (typeof UTM_KEYS)[number];

function WaitlistInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [utm, setUtm] = useState<Partial<Record<UtmKey, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const next: Partial<Record<UtmKey, string>> = {};
    for (const key of UTM_KEYS) {
      const v = searchParams.get(key);
      if (v) next[key] = v;
    }
    setUtm(next);
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const eventId = crypto.randomUUID();
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          email,
          phone,
          instagram_handle: instagram,
          source: "public",
          event_id: eventId,
          ...utm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again.");
        return;
      }
      trackPixel("Lead", { event_id: eventId });
      const params = new URLSearchParams({
        email,
        name: firstName,
        ig: instagram.trim().replace(/^@/, ""),
      });
      router.push(`/waitlist/qualify?${params.toString()}`);
    } catch {
      setError("Network error. Try again.");
    } finally {
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
            Now letting local businesses in
          </span>
          <h1 className="wl-hero-headline">
            Keep posting like you do.{" "}
            <span className="wl-hero-headline-accent">We turn it into locals walking in.</span>
          </h1>
          <p className="wl-hero-sub">
            You post on Instagram like you already do. We turn the right posts into
            local ads that find people on your doorstep. Restaurants, barbers,
            dentists, clinics, gyms, beauticians, opticians. If your business runs
            on locals knowing you exist, get on the list.
          </p>

          <div className="wl-card">
            <form onSubmit={handleSubmit}>
              <div className="wl-card-label">
                <span className="wl-card-label-dot" />
                Free to join · No card needed
              </div>
              <h2 className="wl-card-heading">Get on the waitlist</h2>
              <p className="wl-card-sub">
                Four quick details. If you&rsquo;re a fit, one of us gives you a
                call and walks you through it on a short demo.
              </p>

              <div className="wl-field">
                <label htmlFor="first_name" className="wl-label">First name</label>
                <input
                  id="first_name"
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Your first name"
                  required
                  className="wl-input"
                />
              </div>

              <div className="wl-field">
                <label htmlFor="email" className="wl-label">Business email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@business.com"
                  required
                  className="wl-input"
                />
              </div>

              <div className="wl-field">
                <label htmlFor="phone" className="wl-label">Mobile</label>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07…"
                  required
                  className="wl-input"
                />
              </div>

              <div className="wl-field">
                <label htmlFor="instagram" className="wl-label">Instagram handle</label>
                <input
                  id="instagram"
                  type="text"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@yourbusiness"
                  required
                  className="wl-input"
                />
              </div>

              {error && <p className="wl-error">{error}</p>}

              <button type="submit" disabled={loading} className="wl-btn">
                {loading ? "Adding you…" : "Put me on the list"}
              </button>

              <p className="wl-fine">
                We only use these details to talk to you about SuperPulse. No
                lists, no spam, ever.
              </p>
            </form>
          </div>
        </section>

        <WaitlistLogoStrip />
        <SocialProof />
        <CaseStudies />
      </main>

      <WaitlistFooter />
    </>
  );
}

export default function WaitlistPage() {
  return (
    <Suspense fallback={null}>
      <WaitlistInner />
    </Suspense>
  );
}
