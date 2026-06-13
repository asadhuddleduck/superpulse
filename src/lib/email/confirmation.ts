// Transactional purchase confirmation for the £27 / £97 audit. Sent from the
// SuperPulse Stripe webhook on a new audit purchase. SuperPulse-branded (light),
// no unsubscribe (it's a receipt, not marketing). Replaces the wrong AI Ad Engine
// onboarding email that the shared-account landing-page webhook used to send.
import { sendEmail } from "./send";

export type AuditTier = "audit-27" | "audit-97";

const C = {
  pageBg: "#F4F4F6",
  card: "#FFFFFF",
  border: "#E6E6EA",
  yellow: "#F7CE46",
  green: "#0E9C75",
  ink: "#15151B",
  body: "#3C3C45",
  mist: "#73737E",
};
const FONT = "Inter,-apple-system,'SF Pro Display','Helvetica Neue',Helvetica,Arial,sans-serif";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const BULLETS = [
  "Your profile, bio, link, highlights and pinned content, and what's stopping followers from becoming customers.",
  "The posts we'd put money behind first, and why.",
  "A simple 30-day plan you can act on even if you never use SuperPulse.",
];

export function auditConfirmationEmail(firstName: string, tier: AuditTier): { subject: string; html: string } {
  const hi = firstName ? `Hi ${esc(firstName)},` : "Hi,";
  const is97 = tier === "audit-97";

  const subject = is97 ? "Your audit and Loom walkthrough are confirmed" : "Your £27 Instagram audit is confirmed";
  const confirmLine = is97
    ? "That's your £27 Instagram audit and £97 Loom walkthrough confirmed. Thank you."
    : "That's your £27 Instagram audit confirmed. Thank you.";
  const deliverLine = is97
    ? "Here's what happens now: one of the team goes through your Instagram by hand. Your audit PDF and your personal Loom video both land in your inbox within 24 hours."
    : "Here's what happens now: one of the team goes through your Instagram by hand and writes you a short, plain-English PDF. It lands in your inbox within 24 hours.";

  const p = (t: string) => `<p style="margin:0 0 16px;font-size:16px;color:${C.body};line-height:1.6;">${t}</p>`;
  const bulletRows = BULLETS.map(
    (b) =>
      `<tr><td style="padding:0 0 10px;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.card};border:1px solid ${C.border};border-left:3px solid ${C.yellow};border-radius:10px;"><tr><td style="padding:14px 18px;font-size:15px;color:${C.body};line-height:1.5;">${b}</td></tr></table></td></tr>`,
  ).join("");

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light only"/><meta name="supported-color-schemes" content="light only"/>
<title>SuperPulse</title></head>
<body style="margin:0;padding:0;background:${C.pageBg};font-family:${FONT};color:${C.body};">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.pageBg};">
<tr><td align="center" style="padding:36px 16px 56px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;">

<tr><td align="left" style="padding:0 0 26px;">
  <span style="font-size:15px;color:${C.yellow};">&#9889;</span>
  <span style="font-size:21px;font-weight:800;color:${C.ink};letter-spacing:-0.02em;vertical-align:middle;">SuperPulse</span>
</td></tr>

<tr><td align="left" style="padding:0 0 18px;">
  <h1 style="margin:0;font-size:25px;font-weight:800;color:${C.ink};line-height:1.3;letter-spacing:-0.02em;">${esc(subject)}</h1>
</td></tr>

<tr><td style="padding:0 0 20px;">
  ${p(hi)}
  ${p(confirmLine)}
  ${p(deliverLine)}
  <p style="margin:0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:${C.mist};">What's in it</p>
</td></tr>

${bulletRows}

<tr><td style="padding:12px 0 22px;">
  ${p("You don't need to do anything. Just keep an eye on your inbox. If you've got a question in the meantime, reply to this email, it comes straight to me.")}
  <p style="margin:0;font-size:15px;color:${C.body};line-height:1.5;">Asad</p>
</td></tr>

<tr><td style="padding:8px 0 0;border-top:1px solid ${C.border};">
  <p style="margin:12px 0 0;font-size:12px;color:${C.mist};line-height:1.55;">SuperPulse by Huddle Duck. You're getting this because you bought an Instagram audit at superpulse.io.</p>
</td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  return { subject, html };
}

export async function sendAuditConfirmation(to: string, firstName: string, tier: AuditTier): Promise<void> {
  try {
    const { subject, html } = auditConfirmationEmail(firstName, tier);
    await sendEmail({ to, subject, html });
  } catch (err) {
    console.error("[confirmation] send failed:", err instanceof Error ? err.message : String(err));
  }
}
