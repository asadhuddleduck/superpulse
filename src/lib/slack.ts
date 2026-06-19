let warnedMissingEnv = false;

// Slack incoming webhooks parse mrkdwn in `text`: literal < > enable
// <!channel> pings and <url|label> spoofed links. Escape every interpolated
// user-supplied value before building a notifySlack message.
export function escapeSlackText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Pass `webhookUrlOverride` to route a message to a specific channel (e.g. the
// founder's demo-booking channel via SLACK_DEMO_WEBHOOK_URL); falls back to the
// default SLACK_WEBHOOK_URL when the override is empty/unset.
export async function notifySlack(text: string, webhookUrlOverride?: string): Promise<void> {
  const webhookUrl = webhookUrlOverride?.trim() || process.env.SLACK_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    if (!warnedMissingEnv) {
      warnedMissingEnv = true;
      console.warn("[slack] SLACK_WEBHOOK_URL not set — notifications disabled");
    }
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    console.error("[slack] notify failed:", err instanceof Error ? err.message : String(err));
  }
}
