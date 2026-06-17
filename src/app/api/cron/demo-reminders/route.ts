import { checkCronAuth } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { notifySlack } from "@/lib/slack";
import { sendDemoReminderWhatsApp, whatsappEnabled } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Every 30 min. Sends WhatsApp pre-call reminders (~24h and ~1h before) for booked
// demos. Cal.com still sends its own email invite/reminders; this is the phone
// channel. No-op while WHATSAPP_NOTIFICATIONS_ENABLED is unset, so safe to deploy.
//
// Windows (with a 30-min cadence, each ≥90 min so a tick always lands inside):
//   24h reminder: from 24h before until 90 min before the start
//   1h  reminder: from 90 min before until the start
// A same-day booking made <90 min out skips the 24h reminder and just gets the 1h.
const H = 3_600_000;
const MIN = 60_000;

type Row = {
  email: string;
  start_at: string;
  r24: string | null;
  r1: string | null;
  first_name: string | null;
  phone: string | null;
};

export async function GET(request: Request) {
  const auth = checkCronAuth(request);
  if (auth) return auth;
  if (!whatsappEnabled()) {
    return Response.json({ ok: true, skipped: "WHATSAPP_NOTIFICATIONS_ENABLED not set" });
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  // Booked, future calls; join waitlist for the phone + first name.
  const rows = (
    await db.execute({
      sql: `SELECT q.email AS email, q.demo_scheduled_at AS start_at,
                   q.reminder_24h_sent_at AS r24, q.reminder_1h_sent_at AS r1,
                   w.first_name AS first_name, w.phone AS phone
            FROM qualifier_responses q
            LEFT JOIN waitlist w ON w.email = q.email
            WHERE q.demo_booking_status IN ('booked', 'rescheduled')
              AND q.demo_scheduled_at IS NOT NULL
              AND q.demo_scheduled_at > ?`,
      args: [nowIso],
    })
  ).rows as unknown as Row[];

  let sent24 = 0;
  let sent1 = 0;
  let skippedNoPhone = 0;
  const errors: string[] = [];

  for (const r of rows) {
    const start = new Date(r.start_at).getTime();
    if (Number.isNaN(start)) continue;

    const due24 = !r.r24 && now >= start - 24 * H && now <= start - 90 * MIN;
    const due1 = !r.r1 && now >= start - 90 * MIN && now < start;
    if (!due24 && !due1) continue;

    const phone = (r.phone || "").trim();
    const name = (r.first_name || "").trim();
    if (!phone) {
      skippedNoPhone++;
      continue;
    }

    // Prefer the 1h reminder when both windows overlap at the boundary.
    const kind: "24h" | "1h" = due1 ? "1h" : "24h";
    const ok = await sendDemoReminderWhatsApp(phone, name, r.start_at, kind);
    if (!ok) {
      errors.push(`${kind} send failed: ${r.email}`);
      continue;
    }
    const col = kind === "1h" ? "reminder_1h_sent_at" : "reminder_24h_sent_at";
    await db.execute({
      sql: `UPDATE qualifier_responses SET ${col} = ?, updated_at = ? WHERE email = ?`,
      args: [nowIso, nowIso, r.email],
    });
    if (kind === "1h") sent1++;
    else sent24++;
  }

  if (sent24 || sent1 || errors.length) {
    await notifySlack(
      `⏰ SuperPulse demo reminders\n*24h:* ${sent24}   *1h:* ${sent1}   *No phone:* ${skippedNoPhone}` +
        (errors.length ? `\n${errors.slice(0, 5).join("\n")}` : ""),
    );
  }

  return Response.json({ ok: true, sent24, sent1, skippedNoPhone, errors: errors.length, candidates: rows.length });
}
