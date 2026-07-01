"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const DAYS_PER_MONTH = 30.4;

interface Props {
  locationCount: number;
  minPerLocationDailyPennies: number;
}

const RECOMMENDED_PER_LOCATION_GBP = 5; // SuperPulse's recommended starting budget

function gbp(pennies: number): string {
  return `£${(pennies / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export function BudgetForm({ locationCount, minPerLocationDailyPennies }: Props) {
  const minGBP = minPerLocationDailyPennies / 100;
  const [perLoc, setPerLoc] = useState<string>(String(RECOMMENDED_PER_LOCATION_GBP)); // £/location/day
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const perLocNum = Number(perLoc);
  const valid = Number.isFinite(perLocNum) && perLocNum > 0;
  const perLocPennies = valid ? Math.round(perLocNum * 100) : 0;
  const belowMin = valid && perLocPennies < minPerLocationDailyPennies;
  const dailyTotalPennies = perLocPennies * Math.max(1, locationCount);
  const monthlyPennies = Math.round(dailyTotalPennies * DAYS_PER_MONTH);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || belowMin) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perLocationDailyPennies: perLocPennies }),
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
        <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-mist">Budget per location, per day</span>
          <span className="text-xs font-medium text-viridian">Recommended £{RECOMMENDED_PER_LOCATION_GBP}/day</span>
        </span>
        <div className="mt-2 flex min-h-11 items-center rounded-lg border border-slate bg-graphite px-4 focus-within:border-viridian">
          <span className="text-lg text-mist">£</span>
          <input
            type="number"
            inputMode="decimal"
            min={minGBP}
            step={0.5}
            value={perLoc}
            onChange={(e) => setPerLoc(e.target.value)}
            className="w-full bg-transparent px-2 py-3 text-lg text-white outline-none"
            placeholder={String(RECOMMENDED_PER_LOCATION_GBP)}
          />
          <span className="whitespace-nowrap text-sm text-mist">/day each</span>
        </div>
      </label>

      <Card variant="subtle" className="text-sm text-mist">
        {valid ? (
          <>
            <span className="font-mono tabular-nums text-white">{gbp(dailyTotalPennies)}</span>/day total across{" "}
            {locationCount} location
            {locationCount === 1 ? "" : "s"}
            <span className="text-mist"> · ≈ <span className="font-mono tabular-nums">{gbp(monthlyPennies)}</span>/month on your Meta account</span>
          </>
        ) : (
          <>Enter an amount per location.</>
        )}
        <div className="mt-1 text-xs text-mist">
          Minimum <span className="font-mono tabular-nums">{gbp(minPerLocationDailyPennies)}</span>/day per location (Meta&apos;s delivery floor).
        </div>
      </Card>

      {belowMin ? (
        <p className="text-sm text-red-400">
          Meta needs at least {gbp(minPerLocationDailyPennies)}/day per location to deliver. Nudge it up a little.
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <Button
        type="submit"
        fullWidth
        disabled={!valid || belowMin || submitting}
      >
        {submitting ? "Setting up…" : "Approve and launch"}
      </Button>
    </form>
  );
}
