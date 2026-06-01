// Transactional send via the Resend HTTP API (raw fetch, no SDK dependency).
// Per-recipient sends so we can branch copy on lifecycle state.

const RESEND_ENDPOINT = "https://api.resend.com/emails";
// Sent from the already-verified huddleduck.co.uk Resend domain (SuperPulse is a
// Huddle Duck product). Display name stays "SuperPulse" so waitlist joiners
// recognise it. Override via EMAIL_FROM.
const DEFAULT_FROM = "Asad from SuperPulse <asad@huddleduck.co.uk>";

export interface SendArgs {
  to: string;
  subject: string;
  html: string;
  unsubUrl?: string; // marketing emails set this; transactional ones (receipts) don't
}

export async function sendEmail(args: SendArgs): Promise<{ id: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error("RESEND_API_KEY not set");
  const from = process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;

  // RFC 8058 one-click unsubscribe — only for marketing sends, not receipts.
  const headers = args.unsubUrl
    ? {
        "List-Unsubscribe": `<${args.unsubUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }
    : undefined;

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      ...(headers ? { headers } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { id?: string };
  return { id: data.id ?? "" };
}
