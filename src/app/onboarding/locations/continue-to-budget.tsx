"use client";

import { useState } from "react";

export function ContinueToBudget() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/locations-done", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      window.location.href = "/onboarding/budget";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-10">
      {error ? <p className="mb-2 text-sm text-red-400">{error}</p> : null}
      <button
        type="button"
        onClick={onClick}
        disabled={submitting}
        className="w-full rounded-lg bg-viridian px-6 py-3 text-black font-semibold transition-all hover:bg-viridian/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Saving…" : "Continue to budget →"}
      </button>
    </div>
  );
}
