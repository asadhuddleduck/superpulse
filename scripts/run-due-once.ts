// One-time kickoff: send today's due waitlist emails immediately, so go-live
// doesn't wait for the next Vercel cron tick. Mirrors processDue() in
// src/lib/email/sequence.ts exactly (same due math, same unsub token, same
// branch), reusing the real templates + send modules. Ongoing sends ride the
// deployed daily cron — this is a one-shot.
//
// Run: node --env-file=.env.local --import tsx scripts/run-due-once.ts --send
import crypto from "crypto";
import { createClient } from "@libsql/client";
import { STEPS, LAST_STEP, renderStep, type EmailContext } from "../src/lib/email/templates";
import { sendEmail } from "../src/lib/email/send";

const SEND = process.argv.includes("--send");
const SEND_GAP_MS = 600;
const BASE = (process.env.NEXT_PUBLIC_BASE_URL || "https://www.superpulse.io").replace(/\/$/, "");
const UNSUB_SECRET = process.env.EMAIL_UNSUB_SECRET || process.env.CRON_SECRET || "";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const db = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN! });

function unsubToken(email: string): string {
  return crypto.createHmac("sha256", UNSUB_SECRET).update(email.toLowerCase()).digest("hex").slice(0, 32);
}
function unsubUrl(email: string): string {
  return `${BASE}/api/email/unsubscribe?${new URLSearchParams({ e: email.toLowerCase(), t: unsubToken(email) }).toString()}`;
}
function formatJoinDate(value: string): string {
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${Number(m[1])}`;
  const d = new Date(value);
  return isNaN(d.getTime()) ? "" : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function offsetForStep(step: number): number {
  return STEPS.find((s) => s.step === step)?.offsetDays ?? 0;
}

async function main() {
  const rows = await db.execute({
    sql: `SELECT s.email AS email, s.anchor_at AS anchor_at, s.position AS position,
                 w.first_name AS first_name, w.instagram_handle AS instagram_handle, w.created_at AS created_at
          FROM email_sequence_state s JOIN waitlist w ON w.email = s.email
          WHERE s.status='active' AND s.position < ?
            AND s.email NOT IN (SELECT email FROM email_unsubscribes)
          ORDER BY s.anchor_at ASC`,
    args: [LAST_STEP],
  });

  const now = Date.now();
  let due = 0, sent = 0, errors = 0;
  for (const r of rows.rows as unknown as Array<Record<string, unknown>>) {
    const position = Number(r.position);
    const nextStep = position + 1;
    const anchorMs = new Date(String(r.anchor_at)).getTime();
    if (isNaN(anchorMs)) continue;
    if (anchorMs + offsetForStep(nextStep) * 86_400_000 > now) continue;
    due++;
    const email = String(r.email);
    const ctx: EmailContext = {
      firstName: String(r.first_name ?? "").trim(),
      email,
      igHandle: (r.instagram_handle as string) || undefined,
      unsubUrl: unsubUrl(email),
      joinedDate: formatJoinDate(String(r.created_at ?? "")),
    };
    const boughtR = await db.execute({ sql: `SELECT 1 FROM audit_purchases WHERE email=? AND tier='audit-27' LIMIT 1`, args: [email] });
    const bought = boughtR.rows.length > 0;
    const def = STEPS.find((s) => s.step === nextStep);
    const variant = def?.branches ? (bought ? "bought" : "not-bought") : "default";
    const tmpl = renderStep(nextStep, ctx, bought);

    if (!SEND) {
      console.log(`[dry] ${email} -> step ${nextStep} (${variant})  ${tmpl.subject}`);
      continue;
    }
    try {
      const { id } = await sendEmail({ to: email, subject: tmpl.subject, html: tmpl.html, unsubUrl: ctx.unsubUrl });
      await db.execute({ sql: `INSERT INTO email_sends (email, step, variant, resend_id, status) VALUES (?,?,?,?,?)`, args: [email, nextStep, variant, id, "sent"] });
      await db.execute({ sql: `UPDATE email_sequence_state SET position=?, status=?, updated_at=? WHERE email=?`, args: [nextStep, nextStep >= LAST_STEP ? "completed" : "active", new Date().toISOString(), email] });
      sent++;
      console.log(`sent ${email} -> step ${nextStep} (${variant})  id=${id}`);
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      await db.execute({ sql: `INSERT INTO email_sends (email, step, variant, resend_id, status, error) VALUES (?,?,?,?,?,?)`, args: [email, nextStep, variant, "", "error", msg] });
      console.log(`ERROR ${email} -> step ${nextStep}: ${msg}`);
    }
    await new Promise((res) => setTimeout(res, SEND_GAP_MS));
  }
  console.log(`\n${SEND ? "SENT" : "DRY"} — due ${due}, sent ${sent}, errors ${errors}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
