"use client";

import { useState, useEffect, useRef, Suspense, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import WaitlistHeader from "@/components/waitlist/Header";
import WaitlistFooter from "@/components/waitlist/Footer";
import ConvergenceBackground from "@/components/waitlist/ConvergenceBackground";
import SocialProof from "@/components/waitlist/SocialProof";
import CaseStudies from "@/components/waitlist/CaseStudies";
import WaitlistLogoStrip from "@/components/waitlist/LogoStrip";
import { trackPixel, getOrCreateEventId, persistEventId } from "@/lib/meta-pixel-client";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
type UtmKey = (typeof UTM_KEYS)[number];

const LEAD_KEY = "wl-lead";

function WaitlistInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  // Explicit WhatsApp opt-in (unchecked by default). WhatsApp policy requires prior
  // consent before any business-initiated message; we only WhatsApp leads who tick this.
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [utm, setUtm] = useState<Partial<Record<UtmKey, string>>>({});
  // Which niche head sent them (?source=foodowner / ?niche=accountants). The waitlist
  // + flow + DB are identical for every niche; this is the only per-niche signal.
  const [source, setSource] = useState("public");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    const next: Partial<Record<UtmKey, string>> = {};
    for (const key of UTM_KEYS) {
      const v = searchParams.get(key);
      if (v) next[key] = v;
    }
    setUtm(next);
    // Niche tag from the head page (?source= or ?niche=), slug-sanitised.
    const src = searchParams.get("source") || searchParams.get("niche");
    if (src) {
      const clean = src.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
      if (clean) setSource(clean);
    }
    // Prefill the IG handle when arriving from the gate's "join the waitlist"
    // button (it deep-links ?ig=<username> after a non-allowlisted IG login).
    const ig = searchParams.get("ig");
    if (ig) setInstagram((cur) => cur || `@${ig.replace(/^@/, "")}`);
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const eventId = getOrCreateEventId("lead");
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          email,
          phone,
          instagram_handle: instagram,
          source,
          whatsapp_opt_in: whatsappOptIn,
          event_id: eventId,
          ...utm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again.");
        submittingRef.current = false;
        return;
      }
      trackPixel("Lead", { event_id: eventId });
      persistEventId("lead", eventId);
      const lead = {
        email,
        firstName,
        ig: instagram.trim().replace(/^@/, "").toLowerCase(),
      };
      try {
        sessionStorage.setItem(LEAD_KEY, JSON.stringify(lead));
      } catch {
        /* ignore */
      }
      router.replace("/waitlist/qualify");
    } catch {
      setError("Network error. Try again.");
      submittingRef.current = false;
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
            <form onSubmit={handleSubmit} noValidate>
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
                  onBlur={() => setError(null)}
                  placeholder="Your first name"
                  required
                  maxLength={80}
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
                  onBlur={() => setError(null)}
                  placeholder="you@business.com"
                  required
                  maxLength={150}
                  className="wl-input"
                />
              </div>

              <div className="wl-field">
                <label htmlFor="phone" className="wl-label">Mobile (UK)</label>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => setError(null)}
                  placeholder="07… or +44…"
                  required
                  maxLength={20}
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
                  onBlur={() => setError(null)}
                  placeholder="@yourbusiness"
                  required
                  maxLength={50}
                  className="wl-input"
                />
              </div>

              <label
                style={{
                  display: "flex",
                  gap: 9,
                  alignItems: "flex-start",
                  margin: "4px 0 2px",
                  fontSize: 12.5,
                  lineHeight: 1.45,
                  opacity: 0.8,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={whatsappOptIn}
                  onChange={(e) => setWhatsappOptIn(e.target.checked)}
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
                <span>
                  I&rsquo;m happy for Huddle Duck (SuperPulse) to message me on WhatsApp about
                  my waitlist and any call I book. Just confirmations and reminders. Reply STOP
                  to opt out anytime.
                </span>
              </label>

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
