// Waitlist email sequence engine.
// - Live signups get the welcome immediately (via the waitlist route, best-effort).
// - A daily cron walks everyone and sends their next due step, anchored to their
//   join/backfill date. One email per recipient per run.
// - Copy branches on whether they've bought the £27 audit (checked at send time).
// All sends are gated behind EMAIL_SEQUENCE_ENABLED so the whole thing stays inert
// until go-live is flipped on.

import crypto from "crypto";
import { db } from "@/lib/db";
import { STEPS, LAST_STEP, renderStep, type EmailContext } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";

const FALLBACK_BASE = "https://www.superpulse.io";
const SEND_GAP_MS = 600; // Resend allows ~2 req/s; stay well under.

export function isEnabled(): boolean {
  return process.env.EMAIL_SEQUENCE_ENABLED?.trim() === "1";
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL?.trim() || FALLBACK_BASE).replace(/\/$/, "");
}

// --- unsubscribe token (HMAC over the email) -------------------------------
function unsubSecret(): string {
  return process.env.EMAIL_UNSUB_SECRET?.trim() || process.env.CRON_SECRET?.trim() || "";
}

export function unsubToken(email: string): string {
  return crypto.createHmac("sha256", unsubSecret()).update(email.toLowerCase()).digest("hex").slice(0, 32);
}

export function verifyUnsubToken(email: string, token: string): boolean {
  const expected = unsubToken(email);
  if (!token || token.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function unsubUrl(email: string): string {
  const q = new URLSearchParams({ e: email.toLowerCase(), t: unsubToken(email) });
  return `${baseUrl()}/api/email/unsubscribe?${q.toString()}`;
}

// --- helpers ---------------------------------------------------------------
function offsetForStep(step: number): number {
  return STEPS.find((s) => s.step === step)?.offsetDays ?? 0;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function formatJoinDate(value: string): string {
  if (!value) return "";
  // Stored as "YYYY-MM-DD HH:MM:SS" (SQLite UTC) or ISO "YYYY-MM-DDT...Z".
  // Read the calendar-date prefix directly so the shown date never drifts by
  // server timezone (e.g. a near-midnight UTC row showing the wrong day).
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${Number(m[1])}`;
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

interface WaitlistRow {
  email: string;
  first_name: string | null;
  instagram_handle: string | null;
  created_at: string | null;
}

function buildCtx(row: WaitlistRow): EmailContext {
  return {
    firstName: (row.first_name || "").trim(),
    email: row.email,
    igHandle: row.instagram_handle || undefined,
    unsubUrl: unsubUrl(row.email),
    joinedDate: formatJoinDate(row.created_at || new Date().toISOString()),
  };
}

async function hasBoughtAudit(email: string): Promise<boolean> {
  const r = await db.execute({
    sql: `SELECT 1 FROM audit_purchases WHERE email = ? AND tier = 'audit-27' LIMIT 1`,
    args: [email],
  });
  return r.rows.length > 0;
}

async function logSend(email: string, step: number, variant: string, resendId: string, status: string, error?: string): Promise<void> {
  await db.execute({
    sql: `INSERT INTO email_sends (email, step, variant, resend_id, status, error) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [email, step, variant, resendId, status, error ?? null],
  });
}

async function sendStepTo(row: WaitlistRow, step: number): Promise<void> {
  const ctx = buildCtx(row);
  const bought = await hasBoughtAudit(row.email);
  const def = STEPS.find((s) => s.step === step);
  const variant = def?.branches ? (bought ? "bought" : "not-bought") : "default";
  const tmpl = renderStep(step, ctx, bought);
  try {
    const { id } = await sendEmail({ to: row.email, subject: tmpl.subject, html: tmpl.html, unsubUrl: ctx.unsubUrl });
    await logSend(row.email, step, variant, id, "sent");
  } catch (err) {
    await logSend(row.email, step, variant, "", "error", err instanceof Error ? err.message : String(err));
    throw err;
  }
}

// --- live signup welcome (called from the waitlist route via after()) ------
export async function startSequenceWithWelcome(
  email: string,
  firstName: string,
  igHandle: string,
  joinedIso: string,
): Promise<void> {
  if (!isEnabled()) return;
  const lower = email.toLowerCase();

  const unsub = await db.execute({ sql: `SELECT 1 FROM email_unsubscribes WHERE email = ? LIMIT 1`, args: [lower] });
  if (unsub.rows.length) return;

  const existing = await db.execute({ sql: `SELECT 1 FROM email_sequence_state WHERE email = ? LIMIT 1`, args: [lower] });
  if (existing.rows.length) return; // already in the sequence

  const nowIso = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO email_sequence_state (email, anchor_at, position, status) VALUES (?, ?, -1, 'active')
          ON CONFLICT(email) DO NOTHING`,
    args: [lower, nowIso],
  });

  await sendStepTo({ email: lower, first_name: firstName, instagram_handle: igHandle || null, created_at: joinedIso || nowIso }, 0);
  await db.execute({
    sql: `UPDATE email_sequence_state SET position = 0, updated_at = ? WHERE email = ?`,
    args: [nowIso, lower],
  });
}

// --- cron: send each due recipient their next step -------------------------
export interface ProcessResult {
  due: number;
  sent: number;
  errors: number;
  details: string[];
}

export async function processDue(limit = 200): Promise<ProcessResult> {
  const result: ProcessResult = { due: 0, sent: 0, errors: 0, details: [] };
  if (!isEnabled()) {
    result.details.push("EMAIL_SEQUENCE_ENABLED not set — no-op");
    return result;
  }

  const rows = await db.execute({
    sql: `SELECT s.email AS email, s.anchor_at AS anchor_at, s.position AS position,
                 w.first_name AS first_name, w.instagram_handle AS instagram_handle, w.created_at AS created_at
          FROM email_sequence_state s
          JOIN waitlist w ON w.email = s.email
          WHERE s.status = 'active' AND s.position < ?
            AND s.email NOT IN (SELECT email FROM email_unsubscribes)
          ORDER BY s.anchor_at ASC`,
    args: [LAST_STEP],
  });

  const now = Date.now();
  for (const raw of rows.rows as unknown as Array<Record<string, unknown>>) {
    if (result.sent >= limit) break;
    const position = Number(raw.position);
    const nextStep = position + 1;
    const anchorMs = new Date(String(raw.anchor_at)).getTime();
    if (isNaN(anchorMs)) continue;
    const dueMs = anchorMs + offsetForStep(nextStep) * 86_400_000;
    if (dueMs > now) continue;

    result.due++;
    const row: WaitlistRow = {
      email: String(raw.email),
      first_name: (raw.first_name as string) ?? null,
      instagram_handle: (raw.instagram_handle as string) ?? null,
      created_at: (raw.created_at as string) ?? null,
    };
    try {
      await sendStepTo(row, nextStep);
      await db.execute({
        sql: `UPDATE email_sequence_state SET position = ?, status = ?, updated_at = ? WHERE email = ?`,
        args: [nextStep, nextStep >= LAST_STEP ? "completed" : "active", new Date().toISOString(), row.email],
      });
      result.sent++;
      result.details.push(`${row.email} -> step ${nextStep}`);
    } catch (err) {
      result.errors++;
      result.details.push(`${row.email} -> step ${nextStep} ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
    await new Promise((res) => setTimeout(res, SEND_GAP_MS));
  }
  return result;
}
