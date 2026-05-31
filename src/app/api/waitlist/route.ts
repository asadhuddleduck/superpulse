import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { fireCapi } from "@/lib/meta-capi";
import { startSequenceWithWelcome } from "@/lib/email/sequence";
import { getClientIp, getCookieValue, getUserAgent } from "@/lib/cf-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { isAllowedOrigin } from "@/lib/origin-check";
import { normaliseIgHandle, normalisePhoneUk } from "@/lib/business-types";
import { notifySlack } from "@/lib/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  first_name?: string;
  email?: string;
  phone?: string;
  instagram_handle?: string;
  source?: string;
  event_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request.headers)) {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 403 });
  }

  const rl = await checkRateLimit("waitlist", request.headers);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many submissions. Try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const firstName = body.first_name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const phoneRaw = body.phone?.trim() ?? "";
  const handleRaw = body.instagram_handle?.trim() ?? "";
  const source = body.source?.trim() || "public";

  if (!firstName || firstName.length > 100) {
    return NextResponse.json({ ok: false, error: "First name required" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return NextResponse.json({ ok: false, error: "Valid email required" }, { status: 400 });
  }
  const phoneCheck = normalisePhoneUk(phoneRaw);
  if (!phoneCheck.ok) {
    return NextResponse.json(
      { ok: false, error: "Valid UK phone required" },
      { status: 400 },
    );
  }
  const igCheck = normaliseIgHandle(handleRaw);
  if (!igCheck.ok) {
    return NextResponse.json(
      { ok: false, error: "Valid Instagram handle required" },
      { status: 400 },
    );
  }

  const nowIso = new Date().toISOString();

  const existing = await db.execute({
    sql: `SELECT email FROM waitlist WHERE email = ? LIMIT 1`,
    args: [email],
  });
  const isNewSignup = existing.rows.length === 0;

  await db.execute({
    sql: `INSERT INTO waitlist
            (email, name, first_name, phone, source, instagram_handle,
             utm_source, utm_medium, utm_campaign, utm_content, utm_term, landed_at,
             last_utm_source, last_utm_medium, last_utm_campaign, last_utm_content, last_utm_term, last_landed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET
            name = excluded.name,
            first_name = excluded.first_name,
            phone = excluded.phone,
            source = excluded.source,
            instagram_handle = excluded.instagram_handle,
            last_utm_source = excluded.last_utm_source,
            last_utm_medium = excluded.last_utm_medium,
            last_utm_campaign = excluded.last_utm_campaign,
            last_utm_content = excluded.last_utm_content,
            last_utm_term = excluded.last_utm_term,
            last_landed_at = excluded.last_landed_at`,
    args: [
      email,
      firstName,
      firstName,
      phoneCheck.e164,
      source,
      igCheck.handle,
      clean(body.utm_source),
      clean(body.utm_medium),
      clean(body.utm_campaign),
      clean(body.utm_content),
      clean(body.utm_term),
      nowIso,
      clean(body.utm_source),
      clean(body.utm_medium),
      clean(body.utm_campaign),
      clean(body.utm_content),
      clean(body.utm_term),
      nowIso,
    ],
  });

  if (isNewSignup && source !== "healthcheck") {
    const utmCampaign = clean(body.utm_campaign);
    const utmSource = clean(body.utm_source);
    const utmLine = utmCampaign || utmSource
      ? `\n*Source:* ${[utmSource, utmCampaign].filter(Boolean).join(" / ")}`
      : "";
    await notifySlack(
      `🎉 New SuperPulse waitlist signup\n` +
        `*Name:* ${firstName}\n` +
        `*Email:* ${email}\n` +
        `*Phone:* ${phoneCheck.e164}\n` +
        `*Instagram:* @${igCheck.handle}` +
        utmLine,
    );

    // Welcome email + enrol in the waitlist sequence. Best-effort, post-response.
    // No-op unless EMAIL_SEQUENCE_ENABLED=1, so this is inert until go-live.
    after(async () => {
      try {
        await startSequenceWithWelcome(email, firstName, igCheck.handle, nowIso);
      } catch (err) {
        console.error("[waitlist] welcome email failed:", err instanceof Error ? err.message : String(err));
      }
    });
  }

  const eventId = body.event_id?.trim();
  if (eventId && source !== "healthcheck") {
    await fireCapi({
      event_name: "Lead",
      event_id: eventId,
      email,
      phone_e164: phoneCheck.e164,
      first_name: firstName,
      source_url: request.headers.get("referer") || undefined,
      client_ip: getClientIp(request.headers),
      client_user_agent: getUserAgent(request.headers),
      fbp: getCookieValue(request.headers, "_fbp"),
      fbc: getCookieValue(request.headers, "_fbc"),
    });
  }

  return NextResponse.json({ ok: true });
}
