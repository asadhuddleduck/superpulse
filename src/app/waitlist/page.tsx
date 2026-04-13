"use client";

import { useState, type FormEvent } from "react";
import WaitlistHeader from "@/components/waitlist/Header";
import WaitlistFooter from "@/components/waitlist/Footer";
import ConvergenceBackground from "@/components/waitlist/ConvergenceBackground";
import SocialProof from "@/components/waitlist/SocialProof";
import CaseStudies from "@/components/waitlist/CaseStudies";
import FounderSection from "@/components/waitlist/FounderSection";
import WaitlistLogoStrip from "@/components/waitlist/LogoStrip";

type Stage = "password" | "form" | "success";

export default function WaitlistPage() {
  const [stage, setStage] = useState<Stage>("password");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Wrong password. Ask at the stand.");
        return;
      }
      setStage("form");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, name, email, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again.");
        return;
      }
      setStage("success");
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
        {/* Hero with waitlist card */}
        <section className="wl-hero">
          <span className="wl-hero-eyebrow">
            <span className="wl-hero-eyebrow-dot" />
            Invitation Only
          </span>
          <h1 className="wl-hero-headline">
            You were invited to{" "}
            <span className="wl-hero-headline-accent">SuperPulse</span>.
          </h1>
          <p className="wl-hero-sub">
            A private waitlist for smart local chains. Enter the password you
            were given to join.
          </p>

          <div className="wl-card">
            {stage === "password" && (
              <form onSubmit={handlePasswordSubmit}>
                <div className="wl-card-label">
                  <span className="wl-card-label-dot" />
                  Private Access
                </div>
                <h2 className="wl-card-heading">Enter your invite password</h2>
                <p className="wl-card-sub">
                  This waitlist is only shared with invited businesses. If you
                  don&rsquo;t have a password, it&rsquo;s not for you yet.
                </p>

                <div className="wl-field">
                  <label htmlFor="password" className="wl-label">
                    Invite password
                  </label>
                  <input
                    id="password"
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    className="wl-input"
                  />
                  {error && <p className="wl-error">{error}</p>}
                </div>

                <button
                  type="submit"
                  disabled={loading || password.length === 0}
                  className="wl-btn"
                >
                  {loading ? "Checking\u2026" : "Continue"}
                </button>

                <p className="wl-fine">
                  Your details stay private. No spam, ever.
                </p>
              </form>
            )}

            {stage === "form" && (
              <form onSubmit={handleFormSubmit}>
                <div className="wl-card-label">
                  <span className="wl-card-label-dot" />
                  Access Granted
                </div>
                <h2 className="wl-card-heading">Join the waitlist</h2>
                <p className="wl-card-sub">
                  Leave your details and we&rsquo;ll be in touch before the
                  public launch.
                </p>

                <div className="wl-field">
                  <label htmlFor="name" className="wl-label">
                    Full name
                  </label>
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
                  <label htmlFor="email" className="wl-label">
                    Email
                  </label>
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
                  <label htmlFor="phone" className="wl-label">
                    Phone
                  </label>
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

                {error && <p className="wl-error">{error}</p>}

                <button type="submit" disabled={loading} className="wl-btn">
                  {loading ? "Joining\u2026" : "Join the waitlist"}
                </button>

                <p className="wl-fine">
                  We&rsquo;ll only use your details to contact you about
                  SuperPulse.
                </p>
              </form>
            )}

            {stage === "success" && (
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
                <h2 className="wl-success-title">You&rsquo;re on the list.</h2>
                <p className="wl-success-text">
                  We&rsquo;ll reach out from SuperPulse before the public
                  launch with your early-access details.
                </p>
              </div>
            )}
          </div>
        </section>

        <WaitlistLogoStrip />
        <SocialProof />
        <CaseStudies />
        <FounderSection />

        {/* QR code section */}
        <section className="wl-qr-section">
          <p className="wl-qr-label">Scan to share</p>
          <div className="wl-qr-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/waitlist-qr.svg"
              alt="QR code to superpulse.io/waitlist"
            />
          </div>
          <p className="wl-qr-url">superpulse.io/waitlist</p>
        </section>
      </main>

      <WaitlistFooter />
    </>
  );
}
