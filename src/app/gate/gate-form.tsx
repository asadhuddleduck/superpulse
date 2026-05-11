"use client";

import { useState } from "react";

export default function GateForm({ next, error }: { next: string; error: boolean }) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6">
      <main className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="text-viridian">Super</span>
          <span className="text-sandstorm">Pulse</span>
        </h1>
        <p className="text-sm text-zinc-400">Private beta. Enter the access password to continue.</p>
        <form
          method="POST"
          action="/api/gate"
          className="flex w-full flex-col gap-3"
          onSubmit={() => setSubmitting(true)}
        >
          <input type="hidden" name="next" value={next} />
          <input
            type="password"
            name="password"
            placeholder="Access password"
            required
            autoFocus
            autoComplete="current-password"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-base text-white placeholder:text-zinc-600 focus:border-viridian focus:outline-none"
          />
          {error && (
            <p className="text-sm text-red-400">Wrong password.</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-viridian px-4 py-3 font-semibold text-black transition-all hover:bg-viridian/90 disabled:opacity-50"
          >
            {submitting ? "Checking..." : "Enter"}
          </button>
        </form>
        <p className="text-xs text-zinc-600">
          Not on the list?{" "}
          <a href="/waitlist" className="text-viridian underline">
            Join the waitlist
          </a>
          .
        </p>
      </main>
    </div>
  );
}
