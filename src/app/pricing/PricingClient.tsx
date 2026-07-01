"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-4xl font-bold font-mono tabular-nums text-white sm:text-5xl">
          £27
        </span>
        <span className="text-mist">/ location / month</span>
      </div>
      <p className="mb-6 text-sm text-mist">+ VAT for UK businesses</p>

      {/* Location count selector */}
      <div className="mb-6 rounded-xl border border-slate bg-void/30 p-4">
        <label className="mb-3 block text-sm text-mist">
          How many locations are you boosting?
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center self-start rounded-lg border border-slate sm:self-auto">
            <button
              type="button"
              onClick={() => setLocations((n) => clamp(n - 1))}
              disabled={locations <= 1}
              aria-label="Fewer locations"
              className="min-h-11 min-w-11 rounded-l-lg px-4 py-2 text-lg text-white transition hover:bg-slate disabled:opacity-30"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={MAX_LOCATIONS}
              value={locations}
              onChange={(e) => setLocations(clamp(Number(e.target.value)))}
              className="w-16 bg-transparent text-center text-lg font-semibold font-mono tabular-nums text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => setLocations((n) => clamp(n + 1))}
              disabled={locations >= MAX_LOCATIONS}
              aria-label="More locations"
              className="min-h-11 min-w-11 rounded-r-lg px-4 py-2 text-lg text-white transition hover:bg-slate disabled:opacity-30"
            >
              +
            </button>
          </div>
          <div className="text-sm font-mono tabular-nums text-mist">
            {gbp(SEAT_PRICE)} × {locations} ={" "}
            <span className="font-semibold text-white">{gbp(monthly)}/mo</span> + VAT
          </div>
        </div>
        <p className="mt-3 text-xs text-mist">
          Add or remove locations any time. Adding one later bumps your monthly
          bill by {gbp(SEAT_PRICE)} on the card you save now.
        </p>
      </div>

      <Input
        type="text"
        value={promo}
        onChange={(e) => setPromo(e.target.value)}
        placeholder="Promo code (optional)"
        className="mb-3"
      />

      {error && (
        <div className="mb-3 rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-2.5 text-sm text-red-300">
          {error}
        </div>
      )}

      <Button
        type="button"
        onClick={handleCheckout}
        size="lg"
        fullWidth
        loading={loading}
        disabled={loading}
      >
        {loading
          ? "Opening checkout…"
          : `Continue to secure checkout, ${gbp(monthly)}/mo`}
      </Button>
    </>
  );
}
