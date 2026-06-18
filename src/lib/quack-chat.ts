// Fire-and-forget bridge to the Quack Chat Instagram DM automation. When a lead who DM'd us on
// Instagram joins the waitlist, Quack Chat sends them a one-off welcome DM, matched on the IG
// handle they entered. Quack Chat enforces its OWN compliance gates (24h window, opt-out,
// disclosure, send-once) — this side just hands over the handle. No-op unless both env vars are
// set, so it stays inert until configured in Vercel (same pattern as SLACK_WEBHOOK_URL).
//
// Env (superpulse, Vercel + .env.local):
//   QUACK_CHAT_WELCOME_URL   = https://quack-chat.vercel.app/api/internal/welcome
//   QUACK_CHAT_INTERNAL_TOKEN = <quack-chat's INTERNAL_PROCESS_TOKEN>
export async function notifyWaitlistJoinDm(igHandle: string | null | undefined): Promise<void> {
  const url = process.env.QUACK_CHAT_WELCOME_URL?.trim();
  const token = process.env.QUACK_CHAT_INTERNAL_TOKEN?.trim();
  const handle = igHandle?.trim();
  if (!url || !token || !handle) return;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ igUsername: handle }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error("[quack-chat] welcome DM trigger failed:", res.status);
    }
  } catch (err) {
    console.error("[quack-chat] welcome DM trigger error:", err instanceof Error ? err.message : String(err));
  }
}
