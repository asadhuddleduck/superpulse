import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    _stripe = new Stripe(key, {
      httpClient: Stripe.createFetchHttpClient(),
      appInfo: {
        name: "SuperPulse",
        version: "1.0.0",
        url: "https://superpulse.io",
      },
    });
  }
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    const client = getStripe();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});

/**
 * Normalise a raw Stripe subscription status to the internal subscription_status
 * the dashboard gate understands. Single source of truth shared by the Stripe
 * webhook and the OAuth checkout reconcile so both write paths gate identically
 * — a raw 'incomplete' (3DS/SCA pending) or 'unpaid' must never read as 'active'.
 * Absent/unknown → 'pending' (gated to /pricing).
 */
export function mapSubscriptionStatus(raw: string | null | undefined): string {
  const map: Record<string, string> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    unpaid: "past_due",
    canceled: "canceled",
    incomplete: "pending",
    incomplete_expired: "canceled",
  };
  return (raw && map[raw]) || "pending";
}
