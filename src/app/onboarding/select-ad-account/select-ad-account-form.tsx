"use client";

import { useState } from "react";

interface Choice {
  adAccountId: string;
  name: string;
  businessName: string;
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
          className={`block rounded-lg border px-5 py-4 cursor-pointer transition-all ${
            selected === choice.adAccountId
              ? "border-viridian bg-viridian/10"
              : "border-zinc-800 hover:border-zinc-700"
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
              <div className="text-base font-medium text-zinc-100 truncate">
                {choice.name}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5 truncate">
                {choice.businessName} · {choice.currency}
              </div>
            </div>
            <span
              className={`shrink-0 h-4 w-4 rounded-full border-2 ${
                selected === choice.adAccountId
                  ? "border-viridian bg-viridian"
                  : "border-zinc-600"
              }`}
              aria-hidden
            />
          </div>
        </label>
      ))}

      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={!selected || submitting}
        className="mt-4 w-full rounded-lg bg-viridian px-6 py-3 text-black font-semibold transition-all hover:bg-viridian/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Connecting…" : "Continue"}
      </button>
    </form>
  );
}
