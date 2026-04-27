"use client";

import { useState } from "react";
import type { Location } from "@/lib/queries/locations";

interface Props {
  initialLocations: Location[];
}

export default function LocationsManager({ initialLocations }: Props) {
  const [locations, setLocations] = useState<Location[]>(initialLocations);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [radius, setRadius] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address, radiusMiles: radius }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't add that location.");
        return;
      }
      setLocations((prev) => [
        ...prev,
        {
          id: data.location.id,
          tenantId: "",
          name: data.location.name,
          address: data.location.address,
          latitude: data.location.latitude,
          longitude: data.location.longitude,
          radiusMiles: data.location.radiusMiles,
          createdAt: new Date().toISOString(),
        },
      ]);
      setName("");
      setAddress("");
      setRadius(5);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Remove this location? Active campaigns keep running; only future boosts stop.")) {
      return;
    }
    const res = await fetch(`/api/locations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setLocations((prev) => prev.filter((l) => l.id !== id));
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold">Add a location</h2>

        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">
            Location name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sparkhill branch"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-white placeholder:text-zinc-600 focus:border-viridian outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">
            Full address
          </label>
          <input
            type="text"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 123 Stratford Road, Sparkhill, Birmingham B11 1AA"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-white placeholder:text-zinc-600 focus:border-viridian outline-none"
          />
          <p className="text-xs text-zinc-500 mt-1.5">
            Include street + town + postcode for best accuracy.
          </p>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">
            Targeting radius: <span className="text-white">{radius} miles</span>
          </label>
          <input
            type="range"
            min={1}
            max={25}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full accent-viridian"
          />
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            <span>1 mi</span>
            <span>25 mi</span>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-viridian px-5 py-2.5 text-sm font-semibold text-black hover:bg-viridian/90 disabled:opacity-50 transition"
        >
          {saving ? "Adding..." : "Add location"}
        </button>
      </form>

      <section>
        <h2 className="text-lg font-semibold mb-4">
          Your locations ({locations.length})
        </h2>
        {locations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-8 text-center text-zinc-500">
            No locations yet. Add your first one above to start boosting.
          </div>
        ) : (
          <ul className="space-y-2">
            {locations.map((loc) => (
              <li
                key={loc.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 flex items-start justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-white truncate">{loc.name}</div>
                  <div className="text-sm text-zinc-400 truncate">
                    {loc.address ?? "—"}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {loc.radiusMiles} mi radius · {loc.latitude.toFixed(4)},{" "}
                    {loc.longitude.toFixed(4)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(loc.id)}
                  className="text-xs text-zinc-500 hover:text-red-400 transition shrink-0"
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
