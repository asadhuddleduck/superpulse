"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface Choice {
  adAccountId: string;
  name: string;
  currency: string;
}

export function SelectAdAccountForm({ choices }: { choices: Choice[] }) {
  const [selected, setSelected] = useState<string>(choices[0]?.adAccountId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/select-ad-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adAccountId: selected }),
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
    <form onSubmit={onSubmit} className="space-y-3">
      {choices.map((choice) => (
        <label
          key={choice.adAccountId}
          className={`block cursor-pointer rounded-xl border px-5 py-4 transition-all ${
            selected === choice.adAccountId
              ? "border-viridian bg-viridian/10"
              : "border-slate hover:border-mist/40"
          }`}
        >
          <input
            type="radio"
            name="adAccountId"
            value={choice.adAccountId}
            checked={selected === choice.adAccountId}
            onChange={() => setSelected(choice.adAccountId)}
            className="sr-only"
          />
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate text-base font-medium text-white">
                {choice.name}
              </div>
              <div className="mt-0.5 truncate font-mono text-xs text-mist">
                {choice.currency}
              </div>
            </div>
            <span
              className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                selected === choice.adAccountId
                  ? "border-viridian bg-viridian"
                  : "border-mist/40"
              }`}
              aria-hidden
            />
          </div>
        </label>
      ))}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <Button
        type="submit"
        fullWidth
        disabled={!selected || submitting}
        className="mt-4"
      >
        {submitting ? "Connecting…" : "Continue"}
      </Button>
    </form>
  );
}
