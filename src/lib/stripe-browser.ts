"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

/** Browser Stripe.js � uses NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY. */
export function getStripeBrowser(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
    if (!key) {
      console.warn("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set.");
      stripePromise = Promise.resolve(null);
    } else {
      stripePromise = loadStripe(key);
    }
  }
  return stripePromise;
}
