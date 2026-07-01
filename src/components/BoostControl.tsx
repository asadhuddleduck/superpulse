"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface Props {
  initialPaused: boolean;
}

export default function BoostControl({ initialPaused }: Props) {
  const [paused, setPaused] = useState(initialPaused);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function toggle() {
    const next = !paused;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/boost/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(data.message ?? data.error ?? "Couldn't update. Try again.");
        return;
      }
      setPaused(next);
      if (next) {
        setNote(
          data.campaignsPaused
            ? `Paused. ${data.campaignsPaused} live campaign${data.campaignsPaused === 1 ? "" : "s"} stopped — no more ad spend.`
            : "Paused. SuperPulse won't scan or boost until you resume.",
        );
      } else {
        setNote("Resumed. SuperPulse will pick scanning back up shortly.");
      }
    } catch {
      setNote("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-10 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${paused ? "bg-shadow" : "bg-viridian"}`}
          />
          <p className="font-semibold text-white">
            {paused ? "SuperPulse is paused" : "SuperPulse is running"}
          </p>
        </div>
        <p className="mt-1 text-sm text-mist max-w-xl">
          {paused
            ? "Scanning and boosting are stopped. Resume any time."
            : "Scanning your posts and managing boosts automatically."}
        </p>
        {note ? <p className="mt-2 text-xs text-mist">{note}</p> : null}
      </div>
      <Button
        type="button"
        variant={paused ? "primary" : "secondary"}
        onClick={toggle}
        disabled={busy}
        className="shrink-0"
      >
        {busy ? "…" : paused ? "Resume SuperPulse" : "Pause SuperPulse"}
      </Button>
    </Card>
  );
}
