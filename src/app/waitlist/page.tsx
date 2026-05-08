"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import WaitlistHeader from "@/components/waitlist/Header";
import WaitlistFooter from "@/components/waitlist/Footer";
import ConvergenceBackground from "@/components/waitlist/ConvergenceBackground";
import SocialProof from "@/components/waitlist/SocialProof";
import CaseStudies from "@/components/waitlist/CaseStudies";
import WaitlistLogoStrip from "@/components/waitlist/LogoStrip";

const BUSINESS_TYPES = [
  "Restaurant, takeaway or cafe",
  "Barbers or hairdressers",
  "Beauty, nails or aesthetics",
  "Dentist or orthodontist",
  "Gym or fitness studio",
  "Optician or other clinic",
  "Other local business",
];

export default function WaitlistPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [locations, setLocations] = useState("1");
  const [instagram, setInstagram] = useState("");
  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          locations_count: locations,
          instagram_handle: instagram,
          business_type: businessType,
          source: "public",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again.");
        return;
      }
      const params = new URLSearchParams({
        email,
        name,
        ig: instagram.trim().replace(/^@/, ""),
      });
      router.push(`/waitlist/audit?${params.toString()}`);
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
                Quick details about your business. If you&rsquo;re a fit, one of us
                gives you a call and walks you through it on a short demo.
              </p>

              <div className="wl-field">
                <label htmlFor="name" className="wl-label">Full name</label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="wl-input"
                />
              </div>

              <div className="wl-field">
                <label htmlFor="email" className="wl-label">Email</label>
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
                <label htmlFor="phone" className="wl-label">Phone</label>
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
                <label htmlFor="business_type" className="wl-label">Business type</label>
                <select
                  id="business_type"
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
                <label htmlFor="locations" className="wl-label">How many locations?</label>
                <input
                  id="locations"
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
