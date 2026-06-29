import { NextRequest, NextResponse } from "next/server";
import { getTenantCookie } from "@/lib/auth";
import { impersonationGuard } from "@/lib/hq-auth";
import { setTenantSelfPaused } from "@/lib/queries/tenants";
import { pauseAllCampaigns } from "@/lib/hq-lifecycle";
import { writeAuditEvent } from "@/lib/queries/audit-events";

export const dynamic = "force-dynamic";

// Client self-serve "Pause / Resume SuperPulse". Pausing flips self_paused (every
// v8 cron skips the tenant) AND pauses live campaigns so ad spend stops now.
// Resuming clears the flag; the engine re-activates the tenant on its next cycle.
export async function POST(request: NextRequest) {
  // View-as-client is read-only — never pause/resume a client's account.
  const ro = await impersonationGuard();
  if (ro) return ro;

  const tenantId = await getTenantCookie();
  if (!tenantId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let paused = true;
  try {
    const body = (await request.json()) as { paused?: boolean };
    paused = body.paused !== false; // default to pausing if omitted
  } catch {
    // Empty body → pause.
  }

  await setTenantSelfPaused(tenantId, paused);

  let campaignsPaused = 0;
  if (paused) {
    campaignsPaused = await pauseAllCampaigns(tenantId);
  }

  await writeAuditEvent(
    tenantId,
    paused ? "boost_paused" : "boost_resumed",
    paused
      ? `SuperPulse paused by you — scanning stopped${campaignsPaused ? `, ${campaignsPaused} campaign${campaignsPaused === 1 ? "" : "s"} paused` : ""}`
      : "SuperPulse resumed by you — scanning will pick back up shortly",
    { campaignsPaused },
  );

  return NextResponse.json({ paused, campaignsPaused });
}
