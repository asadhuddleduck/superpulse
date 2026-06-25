import { db } from "@/lib/db";
import { decryptIfNeeded } from "@/lib/crypto";
import { stripe } from "@/lib/stripe";
import { updateNodeStatus } from "@/lib/facebook";
import { getActiveCampaigns, updateLocalCampaignStatus } from "@/lib/queries/campaigns";
import { writeAuditEvent } from "@/lib/queries/audit-events";
import { getTenantById } from "@/lib/queries/tenants";

// Shared lifecycle actions used by the HQ console (Pause / Offboard). Mirrors
// the campaign-pause pattern already used by the Stripe cancellation webhook
// (src/app/api/webhook/stripe/route.ts) so behaviour is identical. Per the
// ≥1p-spend rule we PAUSE campaigns, never delete them.

async function tenantToken(tenantId: string): Promise<string | null> {
  const row = await db.execute({
    sql: "SELECT meta_access_token FROM tenants WHERE id = ?",
    args: [tenantId],
  });
  return decryptIfNeeded(row.rows[0]?.meta_access_token as string | null);
}

/** Pause every ACTIVE campaign for a tenant on Meta + locally. Returns count. */
export async function pauseAllCampaigns(tenantId: string): Promise<number> {
  const campaigns = await getActiveCampaigns(tenantId);
  const token = await tenantToken(tenantId);
  if (!token) return 0;
  let paused = 0;
  for (const c of campaigns) {
    try {
      await updateNodeStatus(c.metaCampaignId, "PAUSED", token);
      await updateLocalCampaignStatus(c.metaCampaignId, "PAUSED");
      paused++;
    } catch {
      /* best-effort, skip */
    }
  }
  return paused;
}

/** Cancel the tenant's Stripe subscription immediately, if any. Best-effort. */
export async function cancelStripeSubscription(tenantId: string): Promise<boolean> {
  const tenant = await getTenantById(tenantId);
  if (!tenant?.stripeSubscriptionId) return false;
  try {
    await stripe.subscriptions.cancel(tenant.stripeSubscriptionId);
    return true;
  } catch (err) {
    console.error("[hq-lifecycle] stripe cancel failed", tenantId, err);
    return false;
  }
}

/** Full offboard side-effects: cancel billing + pause all ads. DB-state flip is
 *  done by offboardTenant() in the queries layer; the caller sequences both. */
export async function offboardSideEffects(tenantId: string): Promise<{ paused: number; canceled: boolean }> {
  const canceled = await cancelStripeSubscription(tenantId);
  const paused = await pauseAllCampaigns(tenantId);
  await writeAuditEvent(tenantId, "subscription_changed", "Offboarded via HQ — billing canceled, campaigns paused", {
    paused,
    canceled,
  });
  return { paused, canceled };
}
