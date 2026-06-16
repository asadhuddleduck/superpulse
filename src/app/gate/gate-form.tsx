"use client";

import { useState } from "react";

export default function GateForm({
  next,
  error,
  denied,
  username,
  showPassword,
}: {
  next: string;
  error: boolean;
  denied: boolean;
  username: string | null;
  showPassword: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const startHref = `/api/auth/gate/start?next=${encodeURIComponent(next)}`;
  const waitlistHref = username ? `/waitlist?ig=${encodeURIComponent(username)}` : "/waitlist";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6">
      <main className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="text-viridian">Super</span>
          <span className="text-sandstorm">Pulse</span>
        </h1>

        {denied ? (
          <>
            <p className="text-sm text-zinc-300">
              {username ? <>@{username} isn&apos;t on the access list yet.</> : "That account isn't on the access list yet."}
            </p>
            <p className="text-sm text-zinc-500">
              SuperPulse is in private beta. Join the waitlist and we&apos;ll be in touch.
            </p>
            <a
              href={waitlistHref}
              className="w-full rounded-lg bg-viridian px-4 py-3 font-semibold text-black transition-all hover:bg-viridian/90"
            >
              Join the waitlist
            </a>
            <a href="/gate" className="text-xs text-zinc-600 underline">
              Try a different account
            </a>
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-400">Private beta. Log in to continue.</p>

            <a
              href={startHref}
              onClick={() => setSubmitting(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-viridian px-4 py-3 font-semibold text-black transition-all hover:bg-viridian/90 disabled:opacity-50"
            >
              {submitting ? "Redirecting…" : "Log in with Instagram"}
            </a>

            {error && <p className="text-sm text-red-400">Login failed. Please try again.</p>}

            {showPassword && (
              <form
                method="POST"
                action="/api/gate"
                className="mt-2 flex w-full flex-col gap-3 border-t border-zinc-900 pt-4"
              >
                <input type="hidden" name="next" value={next} />
                <input
                  type="password"
                  name="password"
                  placeholder="Access password"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-base text-white placeholder:text-zinc-600 focus:border-viridian focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 transition-all hover:border-zinc-500"
                >
                  Enter with password
                </button>
              </form>
            )}

            <p className="text-xs text-zinc-600">
              Not on the list?{" "}
              <a href="/waitlist" className="text-viridian underline">
                Join the waitlist
              </a>
              .
            </p>
          </>
        )}
      </main>
    </div>
  );
}
