/**
 * Creates Stripe Products + recurring monthly Prices for HR Management plans.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/stripe-create-catalog.ts
 *
 * Prints Price IDs to paste into .env.local as STRIPE_PRICE_*.
 */

import Stripe from "stripe";

const PLANS = [
  {
    key: "STARTER",
    name: "HR Management Starter",
    amount: 4900,
    currency: "eur",
  },
  {
    key: "BUSINESS",
    name: "HR Management Business",
    amount: 9900,
    currency: "eur",
  },
  {
    key: "ENTERPRISE",
    name: "HR Management Enterprise",
    amount: 29900,
    currency: "eur",
  },
  {
    key: "CUSTOM",
    name: "HR Management Custom",
    amount: 0,
    currency: "eur",
    note: "Use Dashboard to set a custom price or negotiate � placeholder price skipped if 0",
  },
] as const;

async function main() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    console.error("Set STRIPE_SECRET_KEY (e.g. sk_test_...) and re-run.");
    process.exit(1);
  }

  const stripe = new Stripe(key, { typescript: true });
  const out: Record<string, string> = {};

  for (const plan of PLANS) {
    const product = await stripe.products.create({
      name: plan.name,
      metadata: { plan_key: plan.key },
    });

    if (plan.amount <= 0) {
      console.log(
        `\n[${plan.key}] Product ${product.id} � add a Price manually in Dashboard for "${plan.name}".`,
      );
      continue;
    }

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.amount,
      currency: plan.currency,
      recurring: { interval: "month" },
      metadata: { plan_key: plan.key },
    });
    out[`STRIPE_PRICE_${plan.key}`] = price.id;
    console.log(`\n[${plan.key}] product=${product.id} price=${price.id}`);
  }

  if (Object.keys(out).length) {
    console.log("\n--- Add to .env.local ---\n");
    for (const [k, v] of Object.entries(out)) {
      console.log(`${k}=${v}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
