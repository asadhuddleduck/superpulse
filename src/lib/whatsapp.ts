// WhatsApp Cloud API sender for transactional demo-call notifications (booking
// confirmation + pre-call reminders). Business-initiated WhatsApp messages MUST
// use Meta-APPROVED message templates, so this only sends templates — the copy
// lives in Meta (see docs/WHATSAPP-NOTIFICATIONS.md), we pass the template name
// + ordered body variables.
//
// Mirrors lib/slack.ts / lib/email/send.ts: raw fetch, best-effort, never throws
// into the caller — a failed WhatsApp send must not break the booking webhook,
// since email is the guaranteed channel. Gated behind WHATSAPP_NOTIFICATIONS_ENABLED
// so the code is safe to deploy before the WhatsApp Business account exists.

export function whatsappEnabled(): boolean {
  return process.env.WHATSAPP_NOTIFICATIONS_ENABLED?.trim() === "1";
}

/** Normalise a UK-entered phone to E.164 digits (no '+'), e.g. "07931 055436" →
 *  "447931055436". Returns "" if it can't make sense of it (caller skips the send). */
export function toE164(raw: string): string {
  const cleaned = (raw || "").replace(/[^\d+]/g, "");
  if (!cleaned) return "";
  let s = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  if (s.startsWith("00")) s = s.slice(2); // 0044… → 44…
  if (s.startsWith("0")) s = "44" + s.slice(1); // UK local 07… → 447…
  else if (s.startsWith("7") && s.length === 10) s = "44" + s; // bare 7XXXXXXXXX
  // Already international (44…, or another country code) passes through unchanged.
  return s.length >= 10 ? s : "";
}

/** Friendly Europe/London date+time for body params, e.g. "Thursday 19 June, 2:30 pm". */
export function formatWhenFriendly(iso: string): string {
  if (!iso) return "the time you picked";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Europe/London",
    }).format(new Date(iso));
  } catch {
    return "the time you picked";
  }
}

const langCode = () => process.env.WHATSAPP_TEMPLATE_LANG?.trim() || "en_GB";

/** Send an approved WhatsApp template. `params` fill the body {{1}}, {{2}}… in order.
 *  Returns true on a 200 from the Cloud API, false otherwise (logged, never throws). */
export async function sendWhatsAppTemplate(opts: {
  to: string;
  template: string;
  params?: string[];
  languageCode?: string;
}): Promise<boolean> {
  if (!whatsappEnabled()) return false;

  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const version = process.env.WHATSAPP_GRAPH_VERSION?.trim() || "v21.0";
  if (!token || !phoneNumberId) {
    console.warn("[whatsapp] WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set — skipping send");
    return false;
  }
  if (!opts.template) {
    console.warn("[whatsapp] no template name configured — skipping send");
    return false;
  }
  const to = toE164(opts.to);
  if (!to) {
    console.warn("[whatsapp] unusable phone number — skipping send");
    return false;
  }

  const components = opts.params?.length
    ? [{ type: "body", parameters: opts.params.map((text) => ({ type: "text", text })) }]
    : undefined;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: opts.template,
          language: { code: opts.languageCode || langCode() },
          ...(components ? { components } : {}),
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[whatsapp] send failed ${res.status}: ${body.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[whatsapp] send error:", err instanceof Error ? err.message : String(err));
    return false;
  }
}

/** Immediate "you're booked in for <when>" confirmation. Fired from the Cal webhook. */
export async function sendDemoBookingWhatsApp(phone: string, firstName: string, startIso: string): Promise<boolean> {
  return sendWhatsAppTemplate({
    to: phone,
    template: process.env.WHATSAPP_TEMPLATE_DEMO_CONFIRMATION?.trim() || "",
    params: [firstName || "there", formatWhenFriendly(startIso)],
  });
}

/** Pre-call reminder (~24h or ~1h before). Fired from the demo-reminders cron. */
export async function sendDemoReminderWhatsApp(
  phone: string,
  firstName: string,
  startIso: string,
  kind: "24h" | "1h",
): Promise<boolean> {
  const template =
    kind === "24h"
      ? process.env.WHATSAPP_TEMPLATE_DEMO_REMINDER_24H?.trim()
      : process.env.WHATSAPP_TEMPLATE_DEMO_REMINDER_1H?.trim();
  return sendWhatsAppTemplate({
    to: phone,
    template: template || "",
    params: [firstName || "there", formatWhenFriendly(startIso)],
  });
}
