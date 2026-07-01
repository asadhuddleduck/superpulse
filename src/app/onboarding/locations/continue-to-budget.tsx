"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

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
      <Button
        type="button"
        onClick={onClick}
        disabled={submitting}
        loading={submitting}
        fullWidth
        size="lg"
      >
        {submitting ? "Saving…" : "Continue to budget →"}
      </Button>
    </div>
  );
}
