import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

// Read aggregations for the Agency HQ client roster. Joins the tenants table to
// locations / active_campaigns / performance_data / audit_events for at-a-glance
// status. Live Stripe billing is fetched separately on the detail page (one
// Stripe call per client) to keep the list fast.

export interface ClientSummary {
  id: string;
  name: string | null;
  igUsername: string | null;
  email: string | null;
  adAccountId: string | null;
  status: string;
  subscriptionStatus: string;
  provisioningStatus: string | null;
  legacy: boolean;
  comp: boolean;
  hqPaused: boolean;
  offboardedAt: string | null;
  createdAt: string;
  locationsCount: number;
  campaignsLive: number;
  spendThisMonth: number;
  lastActivity: string | null;
  // derived
  stage: string;
  stepIndex: number; // -1 offboarded, 0..6 onboarding -> live
  planLabel: string;
}

export const ONBOARDING_STEPS = [
  "Signed up",
  "Connect Instagram",
  "Choose Page",
  "Choose ad account",
  "Add locations",
  "Provisioning",
  "Live",
] as const;

function isBilled(row: {
  legacy: boolean;
  comp: boolean;
  subscriptionStatus: string;
}): boolean {
  return row.legacy || row.comp || ["active", "trialing"].includes(row.subscriptionStatus);
}

/** Operator-facing onboarding stage + a step index for the stepper. */
export function deriveStage(t: {
  status: string;
  subscriptionStatus: string;
  provisioningStatus: string | null;
  legacy: boolean;
  comp: boolean;
  hqPaused: boolean;
  metaAccessTokenPresent: boolean;
  adAccountId: string | null;
  locationsCount: number;
}): { stage: string; stepIndex: number } {
  if (t.status === "offboarded") return { stage: "Offboarded", stepIndex: -1 };
  if (t.hqPaused) return { stage: "Paused", stepIndex: 6 };
  if (!isBilled(t)) {
    const label = t.subscriptionStatus === "past_due" ? "Payment failed" : "Awaiting payment";
    return { stage: label, stepIndex: 0 };
  }
  if (!t.metaAccessTokenPresent) return { stage: "Needs Instagram", stepIndex: 1 };
  if (t.status === "pending_page_selection") return { stage: "Choosing Page", stepIndex: 2 };
  if (t.status === "pending_ad_account" || !t.adAccountId) return { stage: "Choosing ad account", stepIndex: 3 };
  if (t.provisioningStatus === "pending_locations" || t.locationsCount === 0)
    return { stage: "Adding locations", stepIndex: 4 };
  if (t.provisioningStatus === "pending_budget") return { stage: "Approving budget", stepIndex: 4 };
  if (t.provisioningStatus === "provisioning") return { stage: "Provisioning", stepIndex: 5 };
  return { stage: "Live", stepIndex: 6 };
}

function planLabel(t: {
  legacy: boolean;
  comp: boolean;
  subscriptionStatus: string;
  status: string;
  paidLocations?: number | null;
}): string {
  if (t.status === "offboarded") return "Ended";
  if (t.legacy) return "Legacy £297";
  if (t.comp) return "Comped";
  switch (t.subscriptionStatus) {
    case "active":
      return t.paidLocations != null
        ? `£${27 * t.paidLocations}/mo (${t.paidLocations} loc)`
        : "£27/location";
    case "trialing":
      return "Trial";
    case "past_due":
      return "Past due";
    case "canceled":
      return "Canceled";
    default:
      return "Unpaid";
  }
}

function monthStart(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function listClientsSummary(): Promise<ClientSummary[]> {
  const result = await db.execute({
    sql: `
      SELECT
        t.id, t.name, t.ig_username, t.email, t.ad_account_id, t.status,
        t.subscription_status, t.provisioning_status, t.legacy, t.comp,
        t.paid_locations, t.hq_paused, t.offboarded_at, t.created_at,
        (t.meta_access_token IS NOT NULL) AS has_token,
        (SELECT COUNT(*) FROM locations l WHERE l.tenant_id = t.id) AS locations_count,
        (SELECT COUNT(*) FROM active_campaigns c WHERE c.tenant_id = t.id AND c.status = 'ACTIVE') AS campaigns_live,
        (SELECT COALESCE(SUM(pd.spend), 0)
           FROM performance_data pd
           JOIN active_campaigns c2 ON c2.meta_campaign_id = pd.campaign_id
          WHERE c2.tenant_id = t.id AND pd.date >= ?) AS spend_month,
        (SELECT MAX(ae.created_at) FROM audit_events ae WHERE ae.tenant_id = t.id) AS last_activity
      FROM tenants t
      ORDER BY
        CASE WHEN t.status = 'offboarded' THEN 1 ELSE 0 END,
        t.created_at DESC
    `,
    args: [monthStart()],
  });

  return result.rows.map((row) => {
    const base = {
      id: row.id as string,
      name: (row.name as string | null) ?? null,
      igUsername: (row.ig_username as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      adAccountId: (row.ad_account_id as string | null) ?? null,
      status: ((row.status as string | null) ?? "pending_oauth") as string,
      subscriptionStatus: ((row.subscription_status as string | null) ?? "pending") as string,
      provisioningStatus: (row.provisioning_status as string | null) ?? null,
      legacy: Number(row.legacy ?? 0) === 1,
      comp: Number(row.comp ?? 0) === 1,
      paidLocations: row.paid_locations == null ? null : Number(row.paid_locations),
      hqPaused: Number(row.hq_paused ?? 0) === 1,
      offboardedAt: (row.offboarded_at as string | null) ?? null,
      createdAt: row.created_at as string,
      locationsCount: Number(row.locations_count ?? 0),
      campaignsLive: Number(row.campaigns_live ?? 0),
      spendThisMonth: Number(row.spend_month ?? 0),
      lastActivity: (row.last_activity as string | null) ?? null,
    };
    const { stage, stepIndex } = deriveStage({
      ...base,
      metaAccessTokenPresent: Number(row.has_token ?? 0) === 1,
    });
    return { ...base, stage, stepIndex, planLabel: planLabel(base) };
  });
}

export interface StripeBilling {
  status: string;
  amountPennies: number | null;
  quantity: number | null;
  interval: string | null;
  currentPeriodEnd: string | null;
  discountLabel: string | null;
  cancelAtPeriodEnd: boolean;
}

/** Live billing for the detail page. Defensive: returns null on any failure. */
export async function getStripeBilling(stripeSubscriptionId: string | null): Promise<StripeBilling | null> {
  if (!stripeSubscriptionId) return null;
  try {
    const sub = (await stripe.subscriptions.retrieve(stripeSubscriptionId)) as unknown as {
      status: string;
      current_period_end?: number;
      cancel_at_period_end?: boolean;
      discount?: { coupon?: { name?: string | null; id?: string } } | null;
      items?: { data: { quantity?: number; price?: { unit_amount?: number | null; recurring?: { interval?: string } } }[] };
    };
    const item = sub.items?.data?.[0];
    const price = item?.price;
    const quantity = item?.quantity ?? null;
    const coupon = sub.discount?.coupon;
    // Per-location: monthly total = unit × quantity (seats).
    const unit = price?.unit_amount ?? null;
    return {
      status: sub.status,
      amountPennies: unit != null ? unit * (quantity ?? 1) : null,
      quantity,
      interval: price?.recurring?.interval ?? null,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
      discountLabel: coupon ? coupon.name || coupon.id || null : null,
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    };
  } catch (err) {
    console.error("[hq] stripe billing fetch failed", err);
    return null;
  }
}

export interface RosterStats {
  total: number;
  live: number;
  onboarding: number;
  paused: number;
  churned: number;
  mrrPennies: number;
}

/** Headline counters for the roster header. MRR is an estimate from flags. */
export function rosterStats(clients: ClientSummary[]): RosterStats {
  let live = 0;
  let onboarding = 0;
  let paused = 0;
  let churned = 0;
  let mrrPennies = 0;
  for (const c of clients) {
    if (c.status === "offboarded" || c.subscriptionStatus === "canceled") churned++;
    else if (c.hqPaused) paused++;
    else if (c.stepIndex >= 6) live++;
    else onboarding++;

    if (c.status !== "offboarded") {
      if (c.legacy) mrrPennies += 29700;
      else if (!c.comp && ["active", "trialing"].includes(c.subscriptionStatus)) mrrPennies += 30000;
    }
  }
  return { total: clients.length, live, onboarding, paused, churned, mrrPennies };
}
