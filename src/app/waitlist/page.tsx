"use client";

import { useState, type FormEvent } from "react";
import LogoStrip from "@/components/LogoStrip";

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
    <div className="min-h-screen bg-black text-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-start pt-14 sm:pt-20 pb-10 px-5">
        <div className="w-full max-w-md">
          {/* Lightning bolt */}
          <div className="flex justify-center mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-14 h-14 text-sandstorm drop-shadow-[0_0_24px_rgba(247,206,70,0.35)]"
              aria-hidden
            >
              <path d="M13 2L4.5 13.5h6L9 22l9.5-12.5h-6L13 2z" />
            </svg>
          </div>

          {/* Wordmark */}
          <h1 className="text-center text-[26px] sm:text-3xl font-bold tracking-tight mb-1">
            <span className="text-viridian">Super</span>
            <span className="text-sandstorm">Pulse</span>
          </h1>
          <p className="text-center text-[11px] uppercase tracking-[0.25em] text-zinc-500 mb-10">
            Invitation Only · Waitlist
          </p>

          {/* Card */}
          <div className="rounded-2xl bg-[#111116] border border-[#1E1E26] shadow-2xl shadow-black/60 p-6 sm:p-8">
            {stage === "password" && (
              <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-5">
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
                    You were invited.
                  </h2>
                  <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                    Enter the password you were given to join the private
                    waitlist for SuperPulse.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="password"
                    className="block text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500 mb-2"
                  >
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
                    className="w-full rounded-lg bg-black border border-[#1E1E26] px-4 py-3.5 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-viridian focus:ring-2 focus:ring-viridian/20 transition"
                  />
                  {error && (
                    <p className="mt-2 text-sm text-red-400">{error}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading || password.length === 0}
                  className="mt-1 w-full rounded-lg bg-sandstorm px-6 py-3.5 font-semibold text-black text-base hover:bg-sandstorm/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-sandstorm/20"
                >
                  {loading ? "Checking…" : "Continue"}
                </button>
              </form>
            )}

            {stage === "form" && (
              <form onSubmit={handleFormSubmit} className="flex flex-col gap-5">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-viridian animate-pulse" />
                    <span className="text-[10px] uppercase tracking-[0.15em] text-viridian font-medium">
                      Access Granted
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
                    Join the waitlist.
                  </h2>
                  <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                    Leave your details and we&rsquo;ll be in touch before the
                    public launch.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="name"
                    className="block text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500 mb-2"
                  >
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
                    className="w-full rounded-lg bg-black border border-[#1E1E26] px-4 py-3.5 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-viridian focus:ring-2 focus:ring-viridian/20 transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500 mb-2"
                  >
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
                    className="w-full rounded-lg bg-black border border-[#1E1E26] px-4 py-3.5 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-viridian focus:ring-2 focus:ring-viridian/20 transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="block text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500 mb-2"
                  >
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
                    className="w-full rounded-lg bg-black border border-[#1E1E26] px-4 py-3.5 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-viridian focus:ring-2 focus:ring-viridian/20 transition"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-400 -mt-1">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 w-full rounded-lg bg-sandstorm px-6 py-3.5 font-semibold text-black text-base hover:bg-sandstorm/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-sandstorm/20"
                >
                  {loading ? "Joining…" : "Join the waitlist"}
                </button>
              </form>
            )}

            {stage === "success" && (
              <div className="flex flex-col items-center text-center py-2">
                <div className="w-16 h-16 rounded-full bg-viridian/10 border border-viridian/30 flex items-center justify-center mb-5">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-8 h-8 text-viridian"
                    aria-hidden
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
                  You&rsquo;re on the list.
                </h2>
                <p className="mt-3 text-sm text-zinc-400 leading-relaxed max-w-xs">
                  We&rsquo;ll reach out from SuperPulse before launch with your
                  early-access details.
                </p>
              </div>
            )}
          </div>

          {/* Footnote */}
          <p className="mt-6 text-center text-[11px] text-zinc-600">
            SuperPulse by Huddle Duck · Smart Instagram boosting for local
            businesses
          </p>
        </div>

        {/* Logo strip */}
        <div className="w-full mt-4">
          <LogoStrip />
        </div>

        {/* QR code */}
        <div className="w-full text-center pt-2 pb-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500 mb-4">
            Scan to share
          </p>
          <div className="inline-block rounded-xl p-4 bg-[#111116] border border-[#1E1E26]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/waitlist-qr.svg"
              alt="QR code to superpulse.io/waitlist"
              width={200}
              height={200}
              className="w-[200px] h-[200px]"
            />
          </div>
          <p className="mt-4 text-[11px] text-zinc-600">
            superpulse.io/waitlist
          </p>
        </div>
      </main>
    </div>
  );
}
