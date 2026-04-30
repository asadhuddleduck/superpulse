"use client";

import { useState } from "react";

export default function PricingClient() {
  const [promo, setPromo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promo_code: promo }),
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
        {loading ? "Opening checkout…" : "Continue to secure checkout"}
      </button>
    </>
  );
}
