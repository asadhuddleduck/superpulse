"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import WaitlistHeader from "@/components/waitlist/Header";
import WaitlistFooter from "@/components/waitlist/Footer";
import ConvergenceBackground from "@/components/waitlist/ConvergenceBackground";
import SocialProof from "@/components/waitlist/SocialProof";
import CaseStudies from "@/components/waitlist/CaseStudies";
import FounderSection from "@/components/waitlist/FounderSection";
import WaitlistLogoStrip from "@/components/waitlist/LogoStrip";

const BUSINESS_TYPES = [
  "Restaurant / takeaway / QSR",
  "Cafe / coffee shop",
  "Barbers / hairdressers",
  "Aesthetics / beauty clinic",
  "Dentist / orthodontist",
  "Gym / fitness studio",
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
            Now opening to local businesses
          </span>
          <h1 className="wl-hero-headline">
            More locals walking in.{" "}
            <span className="wl-hero-headline-accent">Without lifting a finger.</span>
          </h1>
          <p className="wl-hero-sub">
            SuperPulse turns the posts you already make on Instagram into local ads
            that run forever. For restaurants, barbers, dentists, aesthetics
            clinics, gyms — any local business that lives or dies on locals knowing
            you exist. Join the waitlist below.
          </p>

          <div className="wl-card">
            <form onSubmit={handleSubmit}>
              <div className="wl-card-label">
                <span className="wl-card-label-dot" />
                Free to join · No card needed
              </div>
              <h2 className="wl-card-heading">Join the waitlist</h2>
              <p className="wl-card-sub">
                Tell us about your business. If it&rsquo;s a fit, we&rsquo;ll be in
                touch to give you a personal demo.
              </p>

              <div className="wl-field">
                <label htmlFor="name" className="wl-label">Full name</label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
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
                {loading ? "Joining…" : "Join the waitlist"}
              </button>

              <p className="wl-fine">
                We&rsquo;ll only use your details to contact you about SuperPulse.
                No spam, ever.
              </p>
            </form>
          </div>
        </section>

        <WaitlistLogoStrip />
        <SocialProof />
        <CaseStudies />
        <FounderSection />
      </main>

      <WaitlistFooter />
    </>
  );
}
