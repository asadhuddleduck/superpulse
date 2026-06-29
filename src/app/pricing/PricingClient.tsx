"use client";

import { useState } from "react";

const SEAT_PRICE = 27; // £27 per location per month
const MAX_LOCATIONS = 50;

function gbp(n: number): string {
  return `£${n.toLocaleString("en-GB")}`;
}

export default function PricingClient() {
  const [locations, setLocations] = useState(1);
  const [promo, setPromo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthly = SEAT_PRICE * locations;

  function clamp(n: number) {
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(Math.floor(n), MAX_LOCATIONS);
  }

  async function handleCheckout() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promo_code: promo, locations }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Couldn't open checkout.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <>
      {/* Live price */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-5xl font-bold">£27</span>
        <span className="text-zinc-400">/ location / month</span>
      </div>
      <p className="text-sm text-zinc-500 mb-6">+ VAT for UK businesses</p>

      {/* Location count selector */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-black/30 p-4">
        <label className="block text-sm text-zinc-300 mb-3">
          How many locations are you boosting?
        </label>
        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-lg border border-zinc-700">
            <button
              type="button"
              onClick={() => setLocations((n) => clamp(n - 1))}
              disabled={locations <= 1}
              aria-label="Fewer locations"
              className="px-4 py-2 text-lg text-white hover:bg-zinc-800 disabled:opacity-30 rounded-l-lg transition"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={MAX_LOCATIONS}
              value={locations}
              onChange={(e) => setLocations(clamp(Number(e.target.value)))}
              className="w-16 bg-transparent text-center text-lg font-semibold text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => setLocations((n) => clamp(n + 1))}
              disabled={locations >= MAX_LOCATIONS}
              aria-label="More locations"
              className="px-4 py-2 text-lg text-white hover:bg-zinc-800 disabled:opacity-30 rounded-r-lg transition"
            >
              +
            </button>
          </div>
          <div className="text-sm text-zinc-400">
            {gbp(SEAT_PRICE)} × {locations} ={" "}
            <span className="font-semibold text-white">{gbp(monthly)}/mo</span> + VAT
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Add or remove locations any time. Adding one later bumps your monthly
          bill by {gbp(SEAT_PRICE)} on the card you save now.
        </p>
      </div>

      <input
        type="text"
        value={promo}
        onChange={(e) => setPromo(e.target.value)}
        placeholder="Promo code (optional)"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-white placeholder:text-zinc-600 focus:border-viridian outline-none mb-3 text-sm"
      />

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-2 text-sm text-red-300 mb-3">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleCheckout}
        disabled={loading}
        className="w-full rounded-lg bg-viridian px-5 py-3 text-base font-semibold text-black hover:bg-viridian/90 disabled:opacity-50 transition"
      >
        {loading
          ? "Opening checkout…"
          : `Continue to secure checkout — ${gbp(monthly)}/mo`}
      </button>
    </>
  );
}
