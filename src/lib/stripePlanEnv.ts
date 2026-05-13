import "server-only";

import type { PricingPlanId } from "@/lib/pricingPlans";

const ENV_KEYS: Record<PricingPlanId, string> = {
  starter: "NEXT_PUBLIC_STRIPE_PRICE_STARTER",
  business: "NEXT_PUBLIC_STRIPE_PRICE_BUSINESS",
  enterprise: "NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE",
  custom: "NEXT_PUBLIC_STRIPE_PRICE_CUSTOM",
};

export function getStripePriceIdForPlan(plan: PricingPlanId): string | null {
  const key = ENV_KEYS[plan];
  const raw = process.env[key]?.trim();
  return raw || null;
}

/** When false, Stripe checkout and billing APIs are disabled. */
export function isStripeCheckoutEnabled(): boolean {
  const flag = process.env.STRIPE_CHECKOUT_ENABLED?.trim().toLowerCase();
  return flag !== "false" && flag !== "0" && flag !== "no";
}
