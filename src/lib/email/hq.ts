import { sendEmail } from "@/lib/email/send";

// Transactional emails for the Agency HQ console (team invites + password
// resets). Plain, branded, no marketing footer / unsubscribe (these are
// operational, not marketing).

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;color:#ededed">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px">
    <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;margin-bottom:24px">
      <span style="color:#1EBA8F">Super</span><span style="color:#F7CE46">Pulse</span>
      <span style="color:#71717a;font-weight:500"> HQ</span>
    </div>
    <h1 style="font-size:18px;margin:0 0 12px">${title}</h1>
    ${bodyHtml}
    <p style="color:#71717a;font-size:12px;margin-top:32px">If you weren't expecting this, you can ignore it.</p>
  </div></body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#1EBA8F;color:#000;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:8px;margin:8px 0">${label}</a>`;
}

export async function sendHqInviteEmail(args: {
  to: string;
  name?: string | null;
  inviterName?: string | null;
  link: string;
}): Promise<void> {
  const hi = args.name ? `Hi ${args.name},` : "Hi,";
  const who = args.inviterName ? `${args.inviterName} ` : "Someone ";
  await sendEmail({
    to: args.to,
    subject: "You've been added to SuperPulse HQ",
    html: shell(
      "Set your password",
      `<p style="color:#a1a1aa;font-size:14px;line-height:1.5">${hi}<br/>${who}invited you to the SuperPulse HQ console. Set a password to get in. This link works once and expires in 7 days.</p>
       ${button(args.link, "Set your password")}
       <p style="color:#52525b;font-size:12px;word-break:break-all">${args.link}</p>`,
    ),
  });
}

export async function sendJoinLinkEmail(args: {
  to: string;
  link: string;
  type: "paid" | "prepaid" | "magic";
}): Promise<void> {
  const blurb =
    args.type === "paid"
      ? "Tap below to join SuperPulse and get set up. You'll connect your Instagram and we take it from there."
      : args.type === "prepaid"
        ? "You're all set, no payment needed. Tap below to connect your Instagram and get started."
        : "Tap below to pick up where you left off and finish connecting your account.";
  await sendEmail({
    to: args.to,
    subject: "Your SuperPulse link",
    html: shell(
      "You're invited to SuperPulse",
      `<p style="color:#a1a1aa;font-size:14px;line-height:1.5">${blurb}</p>
       ${button(args.link, "Get started")}
       <p style="color:#52525b;font-size:12px;word-break:break-all">${args.link}</p>`,
    ),
  });
}

export async function sendHqResetEmail(args: { to: string; link: string }): Promise<void> {
  await sendEmail({
    to: args.to,
    subject: "Reset your SuperPulse HQ password",
    html: shell(
      "Reset your password",
      `<p style="color:#a1a1aa;font-size:14px;line-height:1.5">Click below to set a new password. This link works once and expires in 1 hour.</p>
       ${button(args.link, "Reset password")}
       <p style="color:#52525b;font-size:12px;word-break:break-all">${args.link}</p>`,
    ),
  });
}
