import { stripe } from "@/lib/stripe";
import type { Tenant } from "@/lib/queries/tenants";

// Per-location billing. The Stripe subscription quantity = the number of
// locations a tenant pays for (£27 each + VAT). A tenant may add up to that many
// locations; adding more bumps the quantity on the card already on file.

/** £27.00 per location per month, in pennies. */
export const SEAT_PRICE_PENNIES = 2700;

/** Hard ceiling on self-serve seats. Bigger chains are handled as legacy/comp. */
export const MAX_LOCATIONS = 50;

/** The recurring £27/location price. Throws (caught by callers) if unset. */
export function getSeatPriceId(): string {
  const id = process.env.STRIPE_PRICE_SUPERPULSE_SEAT;
  if (!id) throw new Error("STRIPE_PRICE_SUPERPULSE_SEAT is not set");
  return id;
}

/** Clamp a requested location count to a whole number in [1, MAX_LOCATIONS]. */
export function clampSeatCount(n: unknown): number {
  const num = Math.floor(Number(n));
  if (!Number.isFinite(num) || num < 1) return 1;
  return Math.min(num, MAX_LOCATIONS);
}

/**
 * Legacy (grandfathered, unlimited locations) and comp (prepaid via an HQ join
 * link) tenants bypass the seat gate entirely — same tenants the dashboard +
 * billing gates already wave through.
 */
export function isUnlimitedSeats(tenant: Pick<Tenant, "legacy" | "comp">): boolean {
  return tenant.legacy || tenant.comp;
}

/** Live seat count from Stripe (subscription quantity), or null on any failure. */
export async function getSubscriptionQuantity(subscriptionId: string): Promise<number | null> {
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const qty = sub.items?.data?.[0]?.quantity;
    return typeof qty === "number" ? qty : null;
  } catch (err) {
    console.error("[seats] getSubscriptionQuantity failed", err);
    return null;
  }
}

/**
 * Set the subscription quantity to `newQuantity` on the saved card (prorated).
 * Updates the first subscription item in place — our subscriptions have exactly
 * one line (the per-location price). Returns the quantity Stripe confirms.
 */
export async function setSubscriptionQuantity(
  subscriptionId: string,
  newQuantity: number,
): Promise<number> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const item = sub.items?.data?.[0];
  if (!item?.id) throw new Error("Subscription has no line item to update");
  const updated = await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: item.id, quantity: newQuantity }],
    proration_behavior: "create_prorations",
  });
  return updated.items?.data?.[0]?.quantity ?? newQuantity;
}

/**
 * How many locations this tenant has paid for. Infinity for legacy/comp (they
 * bypass the gate). Otherwise the synced paid_locations; if not yet synced but a
 * subscription exists, read the live Stripe quantity. 0 for a non-unlimited
 * tenant with no subscription on file.
 *
 * PURE — never writes. It runs on read paths (GET, server-page renders) that are
 * not impersonation-guarded, so it must never mutate the (possibly impersonated)
 * tenant's row. The genuine write site (the POST seat path) persists the backfill
 * itself after the impersonation guard.
 */
export async function resolveSeatCap(tenant: Tenant): Promise<number> {
  if (isUnlimitedSeats(tenant)) return Infinity;
  if (tenant.paidLocations != null) return tenant.paidLocations;
  if (tenant.stripeSubscriptionId) {
    const live = await getSubscriptionQuantity(tenant.stripeSubscriptionId);
    if (live != null) return live;
  }
  return 0;
}
