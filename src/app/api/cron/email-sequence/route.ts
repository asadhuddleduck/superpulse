import { checkCronAuth } from "@/lib/cron-auth";
import { processDue, isEnabled } from "@/lib/email/sequence";
import { notifySlack } from "@/lib/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily (09:00 UTC). Sends each waitlist member their next due email.
// No-op while EMAIL_SEQUENCE_ENABLED is unset, so deploying this is safe.
export async function GET(request: Request) {
  const auth = checkCronAuth(request);
  if (auth) return auth;

  if (!isEnabled()) {
    return Response.json({ ok: true, skipped: "EMAIL_SEQUENCE_ENABLED not set" });
  }

  const result = await processDue();

  if (result.sent > 0 || result.errors > 0) {
    const errorLines = result.details.filter((d) => d.includes("ERROR"));
    await notifySlack(
      `📧 SuperPulse waitlist emails\n*Sent:* ${result.sent}   *Errors:* ${result.errors}   *Due:* ${result.due}` +
        (errorLines.length ? `\n${errorLines.join("\n")}` : ""),
    );
  }

  return Response.json({ ok: true, ...result });
}
