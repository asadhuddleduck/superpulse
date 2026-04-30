"use client";

import { useState } from "react";
import type { Location } from "@/lib/queries/locations";
import LocationIntake from "@/components/LocationIntake";

interface Props {
  initialLocations: Location[];
}

export default function LocationsManager({ initialLocations }: Props) {
  const [locations, setLocations] = useState<Location[]>(initialLocations);

  function handleAdded(loc: {
    id: number;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    radiusMiles: number;
  }) {
    setLocations((prev) => [
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
    ]);
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
                  <div className="font-medium text-white truncate">
                    {loc.name}
                  </div>
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
