import { db } from "@/lib/db";
import { verifyUnsubToken } from "@/lib/email/sequence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function unsubscribe(email: string, token: string): Promise<boolean> {
  if (!email || !token || !verifyUnsubToken(email, token)) return false;
  const e = email.toLowerCase();
  await db.execute({
    sql: `INSERT INTO email_unsubscribes (email, reason) VALUES (?, 'manual') ON CONFLICT(email) DO NOTHING`,
    args: [e],
  });
  await db.execute({
    sql: `UPDATE email_sequence_state SET status = 'unsubscribed', updated_at = ? WHERE email = ?`,
    args: [new Date().toISOString(), e],
  });
  return true;
}

function page(title: string, msg: string): Response {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
<body style="margin:0;background:#050508;color:#F0F0F5;font-family:Inter,-apple-system,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" height="100%" cellpadding="0" cellspacing="0" style="min-height:100vh;"><tr><td align="center" valign="middle" style="padding:40px 20px;">
  <div style="max-width:440px;text-align:center;">
    <div style="font-size:20px;font-weight:800;color:#F7CE46;margin-bottom:18px;">&#9889; SuperPulse</div>
    <h1 style="font-size:22px;margin:0 0 12px;color:#F0F0F5;">${title}</h1>
    <p style="color:#8888A0;font-size:15px;line-height:1.6;margin:0;">${msg}</p>
  </div>
</td></tr></table></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ok = await unsubscribe(url.searchParams.get("e") || "", url.searchParams.get("t") || "");
  return ok
    ? page("You're unsubscribed", "You won't get any more SuperPulse waitlist emails. If this was a mistake, just reply to one of our emails and we'll add you back.")
    : page("Link not valid", "We couldn't process that unsubscribe link. Reply to any of our emails and we'll sort it for you.");
}

// RFC 8058 one-click unsubscribe (List-Unsubscribe-Post). Gmail/Apple call this.
export async function POST(request: Request) {
  const url = new URL(request.url);
  await unsubscribe(url.searchParams.get("e") || "", url.searchParams.get("t") || "");
  return new Response(null, { status: 204 });
}
