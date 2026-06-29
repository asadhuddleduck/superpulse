// Creates (or reuses) the £27/location/month recurring price that powers the
// per-location subscription. Quantity on the Checkout subscription = number of
// locations, so the monthly charge is £27 × locations + VAT.
//
// It mirrors the existing flat £300/mo price (STRIPE_PRICE_SUPERPULSE_MONTHLY):
// same Stripe product, same tax_behavior, so Checkout's automatic_tax keeps
// collecting UK VAT exactly as before. Idempotent — re-running reuses a matching
// £27 recurring price rather than creating duplicates.
//
//   node scripts/create-superpulse-seat-price.mjs
//
// Prints STRIPE_PRICE_SUPERPULSE_SEAT=<id> — add it to .env.local + Vercel.

import Stripe from "stripe";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8")
  .split("\n")
  .filter((l) => l && !l.startsWith("#"))
  .reduce((a, l) => {
    const i = l.indexOf("=");
    if (i > 0) a[l.slice(0, i)] = l.slice(i + 1);
    return a;
  }, {});

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

const SEAT_AMOUNT = 2700; // £27.00
const monthlyPriceId = env.STRIPE_PRICE_SUPERPULSE_MONTHLY;

// Mirror the flat £300 price's product + tax_behavior so VAT collection is
// identical. Fall back to a fresh product if the old price isn't readable.
let productId = null;
let taxBehavior = "exclusive"; // "+ VAT" => VAT added on top
if (monthlyPriceId) {
  try {
    const monthly = await stripe.prices.retrieve(monthlyPriceId);
    productId = typeof monthly.product === "string" ? monthly.product : monthly.product?.id ?? null;
    if (monthly.tax_behavior && monthly.tax_behavior !== "unspecified") {
      taxBehavior = monthly.tax_behavior;
    }
    console.log("Mirroring flat price:", monthlyPriceId, "→ product", productId, "tax_behavior", taxBehavior);
  } catch (err) {
    console.warn("Could not read STRIPE_PRICE_SUPERPULSE_MONTHLY, will create a fresh product:", err.message);
  }
}

if (!productId) {
  const products = await stripe.products.list({ limit: 100, active: true });
  const existing = products.data.find((p) => p.name === "SuperPulse");
  const product = existing ?? (await stripe.products.create({
    name: "SuperPulse",
    description: "AI-driven Instagram post boosting for local businesses. Billed per location.",
  }));
  productId = product.id;
  console.log((existing ? "Reusing" : "Created") + " product:", productId);
}

// Reuse a matching £27 GBP recurring (monthly) price if one already exists.
const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
let price = prices.data.find(
  (p) =>
    p.unit_amount === SEAT_AMOUNT &&
    p.currency === "gbp" &&
    p.type === "recurring" &&
    p.recurring?.interval === "month",
);

if (!price) {
  price = await stripe.prices.create({
    product: productId,
    currency: "gbp",
    unit_amount: SEAT_AMOUNT,
    recurring: { interval: "month" },
    tax_behavior: taxBehavior,
    nickname: "SuperPulse per-location (£27/mo)",
  });
  console.log("Created price:", price.id);
} else {
  console.log("Reusing price:", price.id);
}

console.log("\n--- ENV VAR ---");
console.log("STRIPE_PRICE_SUPERPULSE_SEAT=" + price.id);
