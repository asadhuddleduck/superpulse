"use client";

import { useState } from "react";

const DAYS_PER_MONTH = 30.4;

interface Props {
  locationCount: number;
  minMonthlyPennies: number;
  minDailyPennies: number;
}

function gbp(pennies: number): string {
  return `£${(pennies / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export function BudgetForm({ locationCount, minMonthlyPennies, minDailyPennies }: Props) {
  const minMonthlyGBP = Math.ceil(minMonthlyPennies / 100);
  const [monthly, setMonthly] = useState<string>(String(minMonthlyGBP));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthlyNum = Number(monthly);
  const valid = Number.isFinite(monthlyNum) && monthlyNum > 0;
  const monthlyPennies = valid ? Math.round(monthlyNum * 100) : 0;
  const dailyPennies = valid ? Math.round(monthlyPennies / DAYS_PER_MONTH) : 0;
  const perLocationDailyPennies = valid ? Math.floor(dailyPennies / Math.max(1, locationCount)) : 0;
  const belowMin = valid && monthlyPennies < minMonthlyPennies;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || belowMin) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyBudgetPennies: monthlyPennies }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm text-zinc-400">Monthly ad budget</span>
        <div className="mt-2 flex items-center rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 focus-within:border-viridian">
          <span className="text-zinc-500 text-lg">£</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            className="w-full bg-transparent px-2 py-3 text-lg text-white outline-none"
            placeholder={String(minMonthlyGBP)}
          />
          <span className="text-zinc-500 text-sm">/mo</span>
        </div>
      </label>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/20 px-4 py-3 text-sm text-zinc-400">
        {valid ? (
          <>
            ≈ {gbp(dailyPennies)}/day across {locationCount} location
            {locationCount === 1 ? "" : "s"} ({gbp(perLocationDailyPennies)}/day each)
          </>
        ) : (
          <>Enter a monthly amount.</>
        )}
        <div className="mt-1 text-xs text-zinc-500">
          Minimum for {locationCount} location{locationCount === 1 ? "" : "s"}:{" "}
          {gbp(minMonthlyPennies)}/mo ({gbp(minDailyPennies)}/day).
        </div>
      </div>

      {belowMin ? (
        <p className="text-sm text-amber-400">
          That&apos;s below the minimum to deliver in every location. Raise it to
          at least {gbp(minMonthlyPennies)}/mo, or remove some locations.
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={!valid || belowMin || submitting}
        className="mt-2 w-full rounded-lg bg-viridian px-6 py-3 text-black font-semibold transition-all hover:bg-viridian/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Setting up…" : "Approve and launch"}
      </button>
    </form>
  );
}
