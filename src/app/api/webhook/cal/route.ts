// Cal.com booking webhook — the source of truth for the demo-booking flow.
//
// A qualified owner self-books on /waitlist/demo via the inline Cal embed. The
// embed gives an instant client-side redirect + pixel fire, but it can be lost
// if the tab closes, so THIS server-to-server webhook is what actually records
// the booking, pages the team on Slack, fires the CAPI Schedule conversion, and
// sends the pre-call resources email.
//
// Mirrors the Stripe webhook pattern (src/app/api/webhook/stripe/route.ts):
// read the raw body, verify the signature before parsing, write idempotently.
//
// MUST be registered in Cal at https://www.superpulse.io/api/webhook/cal — the
// apex superpulse.io 307-redirects and providers don't follow redirects on
// delivery (same trap that lost 3 live Stripe payments, 29 May 2026).
import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { fireCapi } from "@/lib/meta-capi";
import { notifySlack, escapeSlackText } from "@/lib/slack";
import { sendDemoBookingConfirmation } from "@/lib/email/confirmation";
import { sendDemoBookingWhatsApp } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CalResponseField = { value?: unknown } | undefined;
type CalAttendee = { email?: string; name?: string; timeZone?: string };
type CalPayload = {
  uid?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  attendees?: CalAttendee[];
  responses?: Record<string, CalResponseField>;
  organizer?: { email?: string; name?: string };
  cancellationReason?: string;
};
type CalWebhook = { triggerEvent?: string; payload?: CalPayload };

function respVal(responses: Record<string, CalResponseField> | undefined, key: string): string {
  const v = responses?.[key]?.value;
  return typeof v === "string" ? v.trim() : "";
}

function formatWhen(iso?: string): string {
  if (!iso) return "(time unknown)";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function verifySignature(raw: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.CAL_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CAL_WEBHOOK_SECRET not configured" }, { status: 500 });
  }

  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-cal-signature-256"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: CalWebhook;
  try {
    event = JSON.parse(raw) as CalWebhook;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const trigger = event.triggerEvent ?? "";
  const payload = event.payload ?? {};
  const uid = (payload.uid ?? "").trim();

  // No uid = nothing to correlate or dedupe on. Ack so Cal stops retrying.
  if (!uid) return NextResponse.json({ ok: true, ignored: "no uid" });

  // Idempotency: if we've already handled this (uid, trigger), ack without
  // re-firing Slack / CAPI / email. Recorded AFTER successful processing below
  // so a mid-handler failure leaves it un-recorded and Cal's retry reprocesses.
  const seen = await db.execute({
    sql: `SELECT 1 FROM cal_webhook_events WHERE cal_booking_uid = ? AND trigger_event = ? LIMIT 1`,
    args: [uid, trigger],
  });
  if (seen.rows.length > 0) return NextResponse.json({ ok: true, duplicate: true });

  const email =
    (respVal(payload.responses, "sp_email") ||
      respVal(payload.responses, "email") ||
      (payload.attendees?.[0]?.email ?? "")).trim().toLowerCase();
  const attendeeName =
    respVal(payload.responses, "name") || (payload.attendees?.[0]?.name ?? "").trim();
  const startIso = payload.startTime ?? "";
  const nowIso = new Date().toISOString();

  if (trigger === "BOOKING_CREATED") {
    // Pull the lead FIRST so we can enforce the call gate at the booking chokepoint.
    // EVERY booking — gated /waitlist/demo, a stale link, or the public Cal page
    // (cal.com/huddleduck/superpulse-demo) — lands on this webhook, so this is the one
    // place a 1-2 location booking is caught no matter how they reached the calendar.
    let firstName = attendeeName;
    let phone = "";
    let ig = "";
    let businessType = "";
    let locations = 0;
    let source = "";
    let optedIn = false;
    if (email) {
      const wl = (
        await db.execute({
          sql: `SELECT first_name, phone, instagram_handle, source, whatsapp_opt_in FROM waitlist WHERE email = ?`,
          args: [email],
        })
      ).rows[0] as { first_name?: string; phone?: string; instagram_handle?: string; source?: string; whatsapp_opt_in?: number } | undefined;
      const q = (
        await db.execute({
          sql: `SELECT business_type, locations_count FROM qualifier_responses WHERE email = ?`,
          args: [email],
        })
      ).rows[0] as { business_type?: string; locations_count?: number } | undefined;
      firstName = (wl?.first_name ?? "").toString().trim() || attendeeName;
      phone = (wl?.phone ?? "").toString().trim();
      ig = (wl?.instagram_handle ?? "").toString().trim();
      businessType = (q?.business_type ?? "").toString().trim();
      locations = Number(q?.locations_count ?? 0);
      source = (wl?.source ?? "").toString().trim();
      optedIn = Number(wl?.whatsapp_opt_in ?? 0) === 1;
    }

    // Call gate: only 3+ location businesses are eligible. A booking from a 1-2 location
    // lead (or an email we don't hold) is OFF-POLICY: record it so it surfaces and can be
    // cancelled, but never treat it as a win — no qualified Slack, no CAPI, no pre-call email,
    // no WhatsApp. 'booked_ineligible' also keeps it out of the reminder cron.
    const eligible = locations >= 3;
    const bookingStatus = eligible ? "booked" : "booked_ineligible";

    const upd = email
      ? await db.execute({
          sql: `UPDATE qualifier_responses
                SET demo_scheduled_at = ?, cal_booking_uid = ?, demo_booking_status = ?,
                    demo_offer_choice = 'yes',
                    demo_requested_at = COALESCE(demo_requested_at, ?),
                    updated_at = ?
                WHERE email = ?`,
          args: [startIso, uid, bookingStatus, nowIso, nowIso, email],
        })
      : { rowsAffected: 0 };

    const unmatched = upd.rowsAffected === 0 ? "\n*Note:* no matching waitlist lead for this email" : "";

    if (eligible) {
      await notifySlack(
        `📞 SuperPulse demo BOOKED\n` +
          `*When:* ${escapeSlackText(formatWhen(startIso))}\n` +
          `*Name:* ${escapeSlackText(firstName) || "(unknown)"}\n` +
          `*Email:* ${escapeSlackText(email) || "(unknown)"}\n` +
          `*Phone:* ${escapeSlackText(phone) || "(none)"}\n` +
          `*Instagram:* @${escapeSlackText(ig) || "(none)"}\n` +
          `*Business type:* ${escapeSlackText(businessType) || "(unknown)"}\n` +
          `*Locations:* ${locations}\n` +
          `*Niche:* ${escapeSlackText(source) || "(public)"}` +
          unmatched,
        process.env.SLACK_DEMO_WEBHOOK_URL,
      );

      if (email) {
        await fireCapi({
          event_name: "Schedule",
          event_id: uid,
          email,
          phone_e164: phone || undefined,
          first_name: firstName || undefined,
          source_url: "https://www.superpulse.io/waitlist/demo",
        });
        await sendDemoBookingConfirmation(email, firstName, startIso);
      }
      // WhatsApp confirmation — ONLY to leads who explicitly opted in (WhatsApp policy).
      // Best-effort; email is the guaranteed channel. No-op unless WHATSAPP_NOTIFICATIONS_ENABLED.
      if (phone && optedIn) {
        await sendDemoBookingWhatsApp(phone, firstName, startIso);
      }
    } else {
      // Off-policy booking — flag for a manual cancel + waitlist DM. Deliberately NO CAPI
      // Schedule, NO pre-call email, NO WhatsApp: we are not nurturing a call we will cancel.
      await notifySlack(
        `⚠️ Off-policy demo booking — ${locations} location${locations === 1 ? "" : "s"} (gate is 3+)\n` +
          `This lead booked a call but is below the 3+ location gate. Cancel it on Cal and DM them the waitlist note.\n` +
          `*When:* ${escapeSlackText(formatWhen(startIso))}\n` +
          `*Name:* ${escapeSlackText(firstName) || "(unknown)"}\n` +
          `*Email:* ${escapeSlackText(email) || "(unknown)"}\n` +
          `*Phone:* ${escapeSlackText(phone) || "(none)"}\n` +
          `*Instagram:* @${escapeSlackText(ig) || "(none)"}\n` +
          `*Business type:* ${escapeSlackText(businessType) || "(unknown)"}\n` +
          `*Locations:* ${locations}\n` +
          `*Niche:* ${escapeSlackText(source) || "(public)"}` +
          unmatched,
        process.env.SLACK_DEMO_WEBHOOK_URL,
      );
    }
  } else if (trigger === "BOOKING_RESCHEDULED") {
    let reschedFirst = attendeeName;
    let reschedPhone = "";
    let reschedOptedIn = false;
    if (email) {
      // Reset the reminder flags so the NEW slot gets fresh 24h/1h reminders.
      await db.execute({
        sql: `UPDATE qualifier_responses
              SET demo_scheduled_at = ?, cal_booking_uid = ?, demo_booking_status = 'rescheduled',
                  reminder_24h_sent_at = NULL, reminder_1h_sent_at = NULL, updated_at = ?
              WHERE email = ?`,
        args: [startIso, uid, nowIso, email],
      });
      const wl = (
        await db.execute({
          sql: `SELECT first_name, phone, whatsapp_opt_in FROM waitlist WHERE email = ?`,
          args: [email],
        })
      ).rows[0] as { first_name?: string; phone?: string; whatsapp_opt_in?: number } | undefined;
      reschedFirst = (wl?.first_name ?? "").toString().trim() || attendeeName;
      reschedPhone = (wl?.phone ?? "").toString().trim();
      reschedOptedIn = Number(wl?.whatsapp_opt_in ?? 0) === 1;
    }
    await notifySlack(
      `🔁 SuperPulse demo rescheduled\n` +
        `*New time:* ${escapeSlackText(formatWhen(startIso))}\n` +
        `*Name:* ${escapeSlackText(reschedFirst) || "(unknown)"}\n` +
        `*Email:* ${escapeSlackText(email) || "(unknown)"}`,
      process.env.SLACK_DEMO_WEBHOOK_URL,
    );
    // Re-confirm the new time over WhatsApp — opted-in leads only (best-effort).
    if (reschedPhone && reschedOptedIn) {
      await sendDemoBookingWhatsApp(reschedPhone, reschedFirst, startIso);
    }
  } else if (trigger === "BOOKING_CANCELLED") {
    if (email) {
      await db.execute({
        sql: `UPDATE qualifier_responses SET demo_booking_status = 'cancelled', updated_at = ? WHERE email = ?`,
        args: [nowIso, email],
      });
    }
    await notifySlack(
      `❌ SuperPulse demo cancelled\n` +
        `*Name:* ${escapeSlackText(attendeeName) || "(unknown)"}\n` +
        `*Email:* ${escapeSlackText(email) || "(unknown)"}` +
        (payload.cancellationReason ? `\n*Reason:* ${escapeSlackText(payload.cancellationReason)}` : ""),
      process.env.SLACK_DEMO_WEBHOOK_URL,
    );
  }

  // Mark handled only after the work above succeeded.
  await db.execute({
    sql: `INSERT INTO cal_webhook_events (cal_booking_uid, trigger_event, payload, created_at)
          VALUES (?, ?, ?, ?) ON CONFLICT(cal_booking_uid, trigger_event) DO NOTHING`,
    args: [uid, trigger, raw.slice(0, 100000), nowIso],
  });

  return NextResponse.json({ ok: true });
}
