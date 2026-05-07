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

async function ensureProduct(name, description, amount) {
  // Try find existing by name
  const products = await stripe.products.list({ limit: 100, active: true });
  const existing = products.data.find((p) => p.name === name);
  let product = existing;
  if (!product) {
    product = await stripe.products.create({ name, description });
    console.log("Created product:", product.id, name);
  } else {
    console.log("Reusing product:", product.id, name);
  }
  // Find a matching price
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
  let price = prices.data.find(
    (p) => p.unit_amount === amount && p.currency === "gbp" && p.type === "one_time",
  );
  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      currency: "gbp",
      unit_amount: amount,
    });
    console.log("Created price:", price.id, amount);
  } else {
    console.log("Reusing price:", price.id, amount);
  }
  return { productId: product.id, priceId: price.id };
}

const audit = await ensureProduct(
  "SuperPulse IG Profile Audit (£27)",
  "Human + AI Instagram profile review. PDF delivered within 24h. Identifies what local audiences would respond to, top-performing post patterns, and 3 specific posts to boost first.",
  2700,
);
const walkthrough = await ensureProduct(
  "SuperPulse Audit + Loom Walkthrough (£97)",
  "Everything in the £27 audit, plus a 5-7 minute Loom video from the team walking through the findings and recommendations for your specific business.",
  9700,
);

console.log("\n--- ENV VARS ---");
console.log("STRIPE_PRICE_AUDIT_27=" + audit.priceId);
console.log("STRIPE_PRICE_AUDIT_97=" + walkthrough.priceId);
console.log("STRIPE_PRODUCT_AUDIT_27=" + audit.productId);
console.log("STRIPE_PRODUCT_AUDIT_97=" + walkthrough.productId);
