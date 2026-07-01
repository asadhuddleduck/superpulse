"use client";

import { useState } from "react";
import type { Location } from "@/lib/queries/locations";
import LocationIntake from "@/components/LocationIntake";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";

interface Props {
  initialLocations: Location[];
  /** Seats the tenant pays for. null = unlimited (legacy/comp). */
  paidLocations?: number | null;
  unlimited?: boolean;
}

export default function LocationsManager({
  initialLocations,
  paidLocations = null,
  unlimited = false,
}: Props) {
  const [locations, setLocations] = useState<Location[]>(initialLocations);
  const [cap, setCap] = useState<number | null>(paidLocations);
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);

  function handleAdded(loc: {
    id: number;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    radiusMiles: number;
  }) {
    setLocations((prev) => {
      const next = [
        ...prev,
        {
          id: loc.id,
          tenantId: "",
          name: loc.name,
          address: loc.address,
          latitude: loc.latitude,
          longitude: loc.longitude,
          radiusMiles: loc.radiusMiles,
          createdAt: new Date().toISOString(),
        },
      ];
      // A confirmed add beyond the cap means a seat was just bought — keep the
      // displayed usage in step until the next reload reconciles it.
      if (!unlimited && cap != null && next.length > cap) setCap(next.length);
      return next;
    });
  }

  // Bulk paste — one address per line. Posts each to /api/locations sequentially
  // (the existing single-POST geocoder), spaced out to respect the geocoder's
  // rate limits (Nominatim ~1 req/s). Good for onboarding a multi-location chain.
  async function handleBulkAdd() {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setBulkBusy(true);
    setBulkErrors([]);
    setBulkProgress({ done: 0, total: lines.length });
    const errs: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const name = (line.split(",")[0] || line).trim();
      try {
        const res = await fetch("/api/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, address: line }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 402 && data.error === "seat_required") {
          errs.push(
            `${line}: skipped, you've used all ${data.paidLocations ?? cap ?? 0} paid locations. Add it on its own above to buy another seat (£27/mo).`,
          );
        } else if (!res.ok) {
          errs.push(`${line}: ${data.message ?? data.error ?? `HTTP ${res.status}`}`);
        } else if (data.location) handleAdded(data.location);
      } catch (e) {
        errs.push(`${line}: ${e instanceof Error ? e.message : "failed"}`);
      }
      setBulkProgress({ done: i + 1, total: lines.length });
      if (i < lines.length - 1) await new Promise((r) => setTimeout(r, 1100));
    }
    setBulkErrors(errs);
    setBulkBusy(false);
    setBulkText("");
  }

  async function handleDelete(id: number) {
    if (
      !confirm(
        "Remove this location? Active campaigns keep running; only future boosts stop.",
      )
    ) {
      return;
    }
    const res = await fetch(`/api/locations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setLocations((prev) => prev.filter((l) => l.id !== id));
    }
  }

  return (
    <div className="space-y-8">
      <LocationIntake onAdded={handleAdded} />

      <details className="rounded-xl border border-slate/70 bg-graphite/40 px-4 pb-4">
        <summary className="cursor-pointer py-3 text-sm font-medium text-white">
          Add many at once
        </summary>
        <p className="mt-2 text-xs text-mist">
          Paste one address per line (include the postcode for best accuracy).
          We&apos;ll geocode each in turn.
        </p>
        <Textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          disabled={bulkBusy}
          rows={6}
          placeholder={"12 High St, Birmingham B1 1AA\n45 Market Sq, Leeds LS1 6DT"}
          className="mt-3 disabled:opacity-50"
        />
        <div className="mt-3 flex items-center gap-3">
          <Button
            type="button"
            variant="primary"
            onClick={handleBulkAdd}
            disabled={bulkBusy || bulkText.trim().length === 0}
            loading={bulkBusy}
          >
            {bulkBusy ? "Adding…" : "Add all"}
          </Button>
          {bulkProgress ? (
            <span className="font-mono text-xs tabular-nums text-mist">
              {bulkProgress.done}/{bulkProgress.total}
            </span>
          ) : null}
        </div>
        {bulkErrors.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-amber-400">
            {bulkErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        ) : null}
      </details>

      <section>
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-lg font-semibold text-white">
            Your locations ({locations.length})
          </h2>
          {!unlimited && cap != null ? (
            <span className="text-sm text-mist">
              {locations.length} of {cap} paid {cap === 1 ? "location" : "locations"} used
            </span>
          ) : unlimited ? (
            <span className="text-sm text-mist">Unlimited locations</span>
          ) : null}
        </div>
        {locations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate bg-graphite/40 p-8 text-center text-mist">
            No locations yet. Add your first one above to start boosting.
          </div>
        ) : (
          <ul className="space-y-2">
            {locations.map((loc) => (
              <li
                key={loc.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-slate bg-graphite/40 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-white">
                    {loc.name}
                  </div>
                  <div className="truncate text-sm text-mist">
                    {loc.address ?? "-"}
                  </div>
                  <div className="mt-1 font-mono text-xs tabular-nums text-mist">
                    {loc.radiusMiles} mi radius · {loc.latitude.toFixed(4)},{" "}
                    {loc.longitude.toFixed(4)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(loc.id)}
                  className="-my-2 -mr-2 flex min-h-11 shrink-0 items-center px-3 text-xs text-mist transition-colors hover:text-red-400"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
