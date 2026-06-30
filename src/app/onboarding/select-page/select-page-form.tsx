"use client";

import { useEffect, useRef, useState } from "react";

interface Choice {
  pageId: string;
  pageName: string;
  igUserId: string;
}

// Shared POST to the guarded select-page handler (POST, not GET, so the tenant
// write is CSRF-safe and impersonation-guarded). Returns the next onboarding
// step to navigate to; throws with a human-readable message on failure.
async function submitPageSelection(pageId: string): Promise<string> {
  const res = await fetch("/api/onboarding/select-page", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pageId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  const body = (await res.json().catch(() => ({}))) as { nextStatus?: string };
  return body.nextStatus === "active" ? "/dashboard" : "/onboarding/select-ad-account";
}

export function SelectPageForm({ choices }: { choices: Choice[] }) {
  const [selected, setSelected] = useState<string>(choices[0]?.pageId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      window.location.href = await submitPageSelection(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {choices.map((choice) => (
        <label
          key={choice.pageId}
          className={`block rounded-lg border px-5 py-4 cursor-pointer transition-all ${
            selected === choice.pageId
              ? "border-viridian bg-viridian/10"
              : "border-zinc-800 hover:border-zinc-700"
          }`}
        >
          <input
            type="radio"
            name="pageId"
            value={choice.pageId}
            checked={selected === choice.pageId}
            onChange={() => setSelected(choice.pageId)}
            className="sr-only"
          />
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-medium text-zinc-100">{choice.pageName}</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                Page ID {choice.pageId} · IG {choice.igUserId}
              </div>
            </div>
            <span
              className={`h-4 w-4 rounded-full border-2 ${
                selected === choice.pageId
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

// Single-Page short-circuit: when the user manages exactly one Page+IG there's
// nothing to pick, so we auto-submit on mount via the SAME guarded POST handler
// the picker uses. This replaces the old GET ?pageId=… server-redirect, which
// performed a tenant write on a GET — CSRF-able under the sameSite=lax auth
// cookie and not impersonation-guarded. Preserves the zero-click UX.
export function AutoSelectPage({ pageId }: { pageId: string }) {
  const [error, setError] = useState<string | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return; // guard against React StrictMode double-invoke
    fired.current = true;
    submitPageSelection(pageId)
      .then((next) => {
        window.location.href = next;
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Something went wrong");
      });
  }, [pageId]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-screen bg-black px-6">
      <main className="max-w-md text-center text-zinc-300">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="text-viridian">Super</span>
          <span className="text-sandstorm">Pulse</span>
        </h1>
        {error ? (
          <p className="mt-6 text-sm text-red-400">{error}</p>
        ) : (
          <p className="mt-6 text-zinc-400">Connecting your page…</p>
        )}
      </main>
    </div>
  );
}
