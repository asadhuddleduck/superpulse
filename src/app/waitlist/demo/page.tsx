"use client";

import { useState, useEffect, useRef } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import WaitlistHeader from "@/components/waitlist/Header";
import WaitlistFooter from "@/components/waitlist/Footer";
import ConvergenceBackground from "@/components/waitlist/ConvergenceBackground";
import SocialProof from "@/components/waitlist/SocialProof";
import { trackPixel } from "@/lib/meta-pixel-client";

const LEAD_KEY = "wl-lead";
// Set in Vercel + .env.local, e.g. "asad/superpulse-demo". The embed is the
// calendar; the Cal webhook (/api/webhook/cal) records the booking server-side.
const CAL_LINK = process.env.NEXT_PUBLIC_CAL_LINK ?? "";

type Lead = { email: string; firstName: string; ig: string };

function readLead(): Lead | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LEAD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Lead>;
    if (!parsed.email) return null;
    return {
      email: String(parsed.email),
      firstName: String(parsed.firstName ?? ""),
      ig: String(parsed.ig ?? ""),
    };
  } catch {
    return null;
  }
}

export default function DemoPage() {
  const [lead, setLead] = useState<Lead | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let found = readLead();
    if (!found) {
      const sp = new URLSearchParams(window.location.search);
      const qEmail = sp.get("email");
      if (qEmail) {
        found = { email: qEmail, firstName: sp.get("name") ?? "", ig: sp.get("ig") ?? "" };
        try {
          sessionStorage.setItem(LEAD_KEY, JSON.stringify(found));
        } catch {
          /* ignore */
        }
      }
    }
    if (!found) {
      window.location.replace("/waitlist");
      return;
    }
    const resolved = found;
    // Server gate: only call-eligible (3+ locations) leads may reach the Cal embed.
    // A 1-2 location lead arriving via a stale/direct link is bounced to the offer
    // BEFORE the calendar renders (the qualify redirect already routes them there;
    // this closes the structural hole). Also pulls the phone to prefill the booking.
    (async () => {
      try {
        const res = await fetch(`/api/demo?email=${encodeURIComponent(resolved.email)}`);
        const data = (await res.json()) as { eligible?: boolean; phone?: string };
        if (!data.eligible) {
          window.location.replace("/waitlist/offer");
          return;
        }
        setPhone((data.phone ?? "").toString().trim());
      } catch {
        // Probe failed (rare network blip). Fail OPEN so a genuine 3+ lead is never
        // stranded; the qualify redirect already keeps 1-2 location leads off this page.
      }
      setLead(resolved);
      setHydrated(true);
    })();
  }, []);

  // Bind the booking-success callback. This is best-effort UX (instant redirect
  // + pixel fire); the Cal webhook is the source of truth for the DB/Slack/CAPI.
  // The booking uid is the shared Meta dedup key between this pixel Schedule and
  // the server CAPI Schedule fired by the webhook.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const cal = await getCalApi();
        if (cancelled) return;
        cal("on", {
          action: "bookingSuccessfulV2",
          callback: (e: unknown) => {
            const detail = (e as { detail?: { data?: { uid?: string } } }).detail;
            const uid = detail?.data?.uid;
            try {
              trackPixel("Schedule", uid ? { event_id: uid } : {});
            } catch {
              /* ignore */
            }
            window.location.href = "/waitlist/offer?demo=1";
          },
        });
      } catch {
        /* embed not ready — webhook still records the booking */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  async function keepSpot() {
    if (!lead) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: lead.email, choice: "no" }),
      });
      const data = await res.json();
      if (!res.ok && !data.redirect) {
        setError(data.error || "Something went wrong. Try again.");
        submittingRef.current = false;
        setLoading(false);
        return;
      }
      window.location.href = data.redirect || "/waitlist/offer";
    } catch {
      setError("Network error. Try again.");
      submittingRef.current = false;
      setLoading(false);
    }
  }

  if (!hydrated || !lead) return null;

  const calLink = CAL_LINK
    ? `${CAL_LINK}?sp_email=${encodeURIComponent(lead.email)}`
    : "";

  return (
    <>
      <WaitlistHeader />
      <ConvergenceBackground />

      <main>
        <section className="wl-hero">
          <span className="wl-hero-eyebrow">
            <span className="wl-hero-eyebrow-dot" />
            You qualified · A call with the team
          </span>
          <h1 className="wl-hero-headline">
            Good news.{" "}
            <span className="wl-hero-headline-accent">Pick a time that suits you.</span>
          </h1>
          <p className="wl-hero-sub">
            Based on your answers, you&rsquo;re a good fit. Grab a slot below and
            one of the team will hop on a short call, look at your Instagram with
            you, and show you exactly how SuperPulse would run for your business.
            About 15 to 20 minutes. Free, and your card is never asked for.
          </p>

          <div className="wl-card wl-card-wide">
            <div className="wl-card-label">
              <span className="wl-card-label-dot" />
              One to one call · Free · No card needed
            </div>

            {error && <p className="wl-error">{error}</p>}

            {calLink ? (
              <div className="wl-cal-embed">
                <Cal
                  calLink={calLink}
                  style={{ width: "100%", height: "100%", overflow: "scroll" }}
                  config={{
                    name: lead.firstName,
                    email: lead.email,
                    // Prefill the lead's phone so it lands on the calendar event the
                    // team opens (the booked-demo Slack alert also carries it).
                    ...(phone ? { notes: `Phone: ${phone}` } : {}),
                    theme: "dark",
                    layout: "month_view",
                    useSlotsViewOnSmallScreen: "true",
                  }}
                />
              </div>
            ) : (
              <p className="wl-card-sub">
                Booking is just being set up. Keep your spot below and we&rsquo;ll
                be in touch to sort a time.
              </p>
            )}

            <p className="wl-fine">
              You pick the time, it drops straight into our calendar, and you get
              the invite and a reminder by email. Nothing to pay.
            </p>

            <p className="wl-skip">
              <button
                type="button"
                onClick={keepSpot}
                disabled={loading}
                className="wl-skip-link wl-skip-link-button"
              >
                No thanks, keep my spot on the waitlist
              </button>
            </p>
          </div>
        </section>

        <SocialProof />
      </main>

      <WaitlistFooter />
    </>
  );
}
