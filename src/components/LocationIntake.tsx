"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Input";

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
  busy: boolean;
  // Set when the server returns 402 seat_required: the line is at the paid
  // location cap and needs an explicit opt-in to add a paid seat.
  seatPrompt: { paidLocations: number; currentLocations: number } | null;
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
          busy: false,
          seatPrompt: null,
        })),
      );
    } catch {
      setGlobalError("Network error. Try again.");
    } finally {
      setParsing(false);
    }
  }

  function patchLine(lineIdx: number, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l, i) => (i === lineIdx ? { ...l, ...patch } : l)));
  }

  // addSeat=true opts into bumping the Stripe quantity (£27/mo) on the saved card
  // when the tenant is already at their paid location cap.
  async function submitLine(lineIdx: number, addSeat: boolean) {
    const line = lines[lineIdx];
    if (!line.result || line.result.candidates.length === 0) return;
    const candidate = line.result.candidates[line.selectedIdx];
    if (!candidate) return;

    patchLine(lineIdx, { busy: true, error: null });
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: candidate.name,
          address: candidate.address,
          latitude: candidate.latitude,
          longitude: candidate.longitude,
          radiusMiles: radius,
          addSeat,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 402 && data.error === "seat_required") {
        patchLine(lineIdx, {
          busy: false,
          seatPrompt: {
            paidLocations: Number(data.paidLocations ?? 0),
            currentLocations: Number(data.currentLocations ?? 0),
          },
        });
        return;
      }
      if (!res.ok) {
        patchLine(lineIdx, {
          busy: false,
          seatPrompt: null,
          error: data.message ?? data.error ?? "Save failed.",
        });
        return;
      }
      patchLine(lineIdx, { saved: true, error: null, seatPrompt: null, busy: false });
      onAdded?.(data.location);
    } catch {
      patchLine(lineIdx, { busy: false, error: "Network error. Try again." });
    }
  }

  function handleConfirm(lineIdx: number) {
    void submitLine(lineIdx, false);
  }
  function confirmAddSeat(lineIdx: number) {
    void submitLine(lineIdx, true);
  }
  function cancelSeat(lineIdx: number) {
    patchLine(lineIdx, { seatPrompt: null });
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
      <Card>
        <form onSubmit={handleParse} className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            Tell us where your locations are
          </h2>
          <p className="text-sm text-mist">
            Type each location on a new line. Include the postcode if you can,
            biz name + postcode is enough.
          </p>

          <Textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Heavenly Desserts Coventry Road B10 0RX
Phat Buns 89 Stratford Rd, Sparkhill B11 1RA`}
            className="font-mono"
          />

          <div>
            <label className="mb-1.5 block text-sm text-mist">
              Targeting radius:{" "}
              <span className="font-mono tabular-nums text-white">
                {radius} miles
              </span>
            </label>
            <input
              type="range"
              min={1}
              max={25}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-viridian"
            />
            <div className="mt-1 flex justify-between font-mono text-xs text-mist">
              <span>1 mi</span>
              <span>25 mi</span>
            </div>
          </div>

          {globalError && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {globalError}
            </div>
          )}

          <Button type="submit" variant="primary" fullWidth disabled={parsing} loading={parsing}>
            {parsing ? "Looking up…" : "Find these locations"}
          </Button>
        </form>
      </Card>
    );
  }

  // Stage 2: candidate confirmation per line.
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Confirm matches</h2>
        <Button type="button" variant="ghost" onClick={handleStartOver}>
          Start over
        </Button>
      </div>

      {lines.map((line, lineIdx) => (
        <Card key={lineIdx}>
          <p className="mb-2 text-xs uppercase tracking-wide text-mist">
            You typed
          </p>
          <p className="mb-4 font-mono text-sm text-mist">{line.input}</p>

          {line.saved ? (
            <div className="rounded-lg border border-viridian/40 bg-viridian/5 px-4 py-3 text-sm text-viridian">
              Saved.
            </div>
          ) : line.result && line.result.candidates.length > 0 ? (
            <>
              <p className="mb-2 text-xs uppercase tracking-wide text-mist">
                Did you mean
              </p>
              <div className="mb-4 space-y-2">
                {line.result.candidates.map((c, ci) => (
                  <label
                    key={ci}
                    className={`block cursor-pointer rounded-lg border px-4 py-3 transition ${
                      line.selectedIdx === ci
                        ? "border-viridian bg-viridian/5"
                        : "border-slate bg-void/40 hover:border-mist/40"
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
                      <div className="mt-1 text-xs text-mist">
                        Postcode area only. Biz lookup didn&apos;t return a match.
                      </div>
                    )}
                  </label>
                ))}
              </div>
              {line.result?.message && (
                <p className="mb-3 text-xs text-mist">{line.result.message}</p>
              )}
              {line.error && (
                <div className="mb-3 rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-2 text-sm text-red-300">
                  {line.error}
                </div>
              )}
              {line.seatPrompt ? (
                <Card variant="accent">
                  <p className="text-sm text-mist">
                    You&apos;re using all{" "}
                    <span className="font-semibold text-sandstorm">
                      {line.seatPrompt.paidLocations}
                    </span>{" "}
                    location{line.seatPrompt.paidLocations === 1 ? "" : "s"} you pay
                    for. Add this one for{" "}
                    <span className="font-semibold text-white">£27/mo</span> (+ VAT)
                    on the card you already have on file?
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => confirmAddSeat(lineIdx)}
                      disabled={line.busy}
                      loading={line.busy}
                    >
                      {line.busy ? "Adding…" : "Add location (£27/mo)"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => cancelSeat(lineIdx)}
                      disabled={line.busy}
                    >
                      Not now
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => handleConfirm(lineIdx)}
                    disabled={line.busy}
                    loading={line.busy}
                  >
                    {line.busy ? "Saving…" : "Confirm"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleRetry(lineIdx)}
                  >
                    None of these, let me retry
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="mb-3 text-sm text-mist">
                {line.result?.message ?? "Couldn't find that one."}
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleRetry(lineIdx)}
              >
                Retry this one
              </Button>
            </>
          )}
        </Card>
      ))}
    </div>
  );
}
