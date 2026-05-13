let warnedMissingEnv = false;

export async function notifySlack(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL?.trim();
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
