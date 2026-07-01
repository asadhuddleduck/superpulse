"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Wordmark } from "@/components/ui/Wordmark";
import { FadeIn } from "@/components/ui/FadeIn";

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-void px-6 py-12">
      <FadeIn className="w-full max-w-sm">
        <main className="flex w-full flex-col items-center gap-6 text-center">
          <Wordmark size="xl" href="/" />

          {denied ? (
            <>
              <p className="text-sm text-mist">
                {username ? (
                  <>@{username} isn&apos;t on the access list yet.</>
                ) : (
                  "That account isn't on the access list yet."
                )}
              </p>
              <p className="text-sm text-mist">
                SuperPulse is in private beta. Join the waitlist and we&apos;ll be in touch.
              </p>
              <Button href={waitlistHref} fullWidth>
                Join the waitlist
              </Button>
              <a
                href="/gate"
                className="text-xs text-shadow underline underline-offset-2 transition-colors hover:text-mist"
              >
                Try a different account
              </a>
            </>
          ) : (
            <>
              <p className="text-sm text-mist">Private beta. Log in to continue.</p>

              <Button
                href={startHref}
                fullWidth
                onClick={() => setSubmitting(true)}
              >
                {submitting ? "Redirecting…" : "Log in with Instagram"}
              </Button>

              {error && <p className="text-sm text-red-400">Login failed. Please try again.</p>}

              {showPassword && (
                <form
                  method="POST"
                  action="/api/gate"
                  className="mt-2 flex w-full flex-col gap-3 border-t border-slate pt-4"
                >
                  <input type="hidden" name="next" value={next} />
                  <Input
                    type="password"
                    name="password"
                    placeholder="Access password"
                    required
                    autoComplete="current-password"
                  />
                  <Button type="submit" variant="secondary" fullWidth>
                    Enter with password
                  </Button>
                </form>
              )}

              <p className="text-xs text-mist">
                Not on the list?{" "}
                <a href="/waitlist" className="text-viridian underline underline-offset-2">
                  Join the waitlist
                </a>
                .
              </p>
            </>
          )}
        </main>
      </FadeIn>
    </div>
  );
}
