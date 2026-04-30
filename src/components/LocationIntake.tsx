"use client";

import { useState } from "react";

interface Candidate {
  display: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  postcode: string | null;
  source: "nominatim" | "postcode-centroid";
}

interface ParseResult {
  input: string;
  candidates: Candidate[];
  message?: string;
}

interface AddedLocation {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMiles: number;
}

interface Props {
  onAdded?: (loc: AddedLocation) => void;
  defaultRadius?: number;
}

/** Per-line state during the parse → confirm flow. */
interface LineState {
  input: string;
  result: ParseResult | null;
  selectedIdx: number;
  error: string | null;
  saved: boolean;
}

export default function LocationIntake({ onAdded, defaultRadius = 5 }: Props) {
  const [text, setText] = useState("");
  const [radius, setRadius] = useState(defaultRadius);
  const [parsing, setParsing] = useState(false);
  const [lines, setLines] = useState<LineState[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  async function handleParse(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);
    const split = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (split.length === 0) {
      setGlobalError("Type at least one location.");
      return;
    }

    setParsing(true);
    try {
      const res = await fetch("/api/locations/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          split.length === 1 ? { text: split[0] } : { texts: split },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setGlobalError(data.error ?? "Parser failed.");
        return;
      }
      const results: ParseResult[] = Array.isArray(data.results)
        ? data.results
        : [data];
      setLines(
        results.map((r) => ({
          input: r.input,
          result: r,
          selectedIdx: 0,
          error: null,
          saved: false,
        })),
      );
    } catch {
      setGlobalError("Network error. Try again.");
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm(lineIdx: number) {
    const line = lines[lineIdx];
    if (!line.result || line.result.candidates.length === 0) return;
    const candidate = line.result.candidates[line.selectedIdx];
    if (!candidate) return;

    const res = await fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: candidate.name,
        address: candidate.address,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        radiusMiles: radius,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLines((prev) =>
        prev.map((l, i) =>
          i === lineIdx ? { ...l, error: data.error ?? "Save failed." } : l,
        ),
      );
      return;
    }
    setLines((prev) =>
      prev.map((l, i) =>
        i === lineIdx ? { ...l, saved: true, error: null } : l,
      ),
    );
    onAdded?.(data.location);
  }

  function handleRetry(lineIdx: number) {
    setLines((prev) => prev.filter((_, i) => i !== lineIdx));
  }

  function handleStartOver() {
    setLines([]);
    setText("");
  }

  // Stage 1: textarea.
  if (lines.length === 0) {
    return (
      <form
        onSubmit={handleParse}
        className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold">Tell us where your locations are</h2>
        <p className="text-sm text-zinc-400">
          Type each location on a new line. Include the postcode if you can —
          biz name + postcode is enough.
        </p>

        <textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Heavenly Desserts Coventry Road B10 0RX
Phat Buns 89 Stratford Rd, Sparkhill B11 1RA`}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-white placeholder:text-zinc-600 focus:border-viridian outline-none font-mono text-sm"
        />

        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">
            Targeting radius:{" "}
            <span className="text-white">{radius} miles</span>
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

        {globalError && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {globalError}
          </div>
        )}

        <button
          type="submit"
          disabled={parsing}
          className="rounded-lg bg-viridian px-5 py-2.5 text-sm font-semibold text-black hover:bg-viridian/90 disabled:opacity-50 transition"
        >
          {parsing ? "Looking up…" : "Find these locations"}
        </button>
      </form>
    );
  }

  // Stage 2: candidate confirmation per line.
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Confirm matches</h2>
        <button
          type="button"
          onClick={handleStartOver}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition"
        >
          Start over
        </button>
      </div>

      {lines.map((line, lineIdx) => (
        <div
          key={lineIdx}
          className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
        >
          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
            You typed
          </p>
          <p className="text-sm text-zinc-300 mb-4 font-mono">{line.input}</p>

          {line.saved ? (
            <div className="rounded-lg border border-viridian/40 bg-viridian/5 px-4 py-3 text-sm text-viridian">
              Saved.
            </div>
          ) : line.result && line.result.candidates.length > 0 ? (
            <>
              <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
                Did you mean
              </p>
              <div className="space-y-2 mb-4">
                {line.result.candidates.map((c, ci) => (
                  <label
                    key={ci}
                    className={`block cursor-pointer rounded-lg border px-4 py-3 transition ${
                      line.selectedIdx === ci
                        ? "border-viridian bg-viridian/5"
                        : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`candidate-${lineIdx}`}
                      checked={line.selectedIdx === ci}
                      onChange={() =>
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === lineIdx ? { ...l, selectedIdx: ci } : l,
                          ),
                        )
                      }
                      className="sr-only"
                    />
                    <div className="text-sm text-white">{c.display}</div>
                    {c.source === "postcode-centroid" && (
                      <div className="text-xs text-zinc-500 mt-1">
                        Postcode area only — biz lookup didn&apos;t return a match.
                      </div>
                    )}
                  </label>
                ))}
              </div>
              {line.result?.message && (
                <p className="text-xs text-zinc-500 mb-3">{line.result.message}</p>
              )}
              {line.error && (
                <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-2 text-sm text-red-300 mb-3">
                  {line.error}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleConfirm(lineIdx)}
                  className="rounded-lg bg-viridian px-4 py-2 text-sm font-semibold text-black hover:bg-viridian/90 transition"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => handleRetry(lineIdx)}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-600 transition"
                >
                  None of these — let me retry
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-400 mb-3">
                {line.result?.message ?? "Couldn't find that one."}
              </p>
              <button
                type="button"
                onClick={() => handleRetry(lineIdx)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-600 transition"
              >
                Retry this one
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
