import { LandingView } from "@/components/landing/LandingView";
import type { StripePriceIds } from "@/lib/pricingPlans";
import { isStripeCheckoutEnabled } from "@/lib/stripePlanEnv";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HR Management Simplified",
  description:
    "Manage employees, attendance, payroll, and documents in one place. Built for Romanian companies, ready for the world.",
};

export default function HomePage() {
  const stripePriceIds: StripePriceIds = {
    starter: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER?.trim() ?? "",
    business: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS?.trim() ?? "",
    enterprise: process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE?.trim() ?? "",
    custom: process.env.NEXT_PUBLIC_STRIPE_PRICE_CUSTOM?.trim() ?? "",
  };

  const salesEmail = process.env.NEXT_PUBLIC_SALES_EMAIL?.trim() ?? "";
  const contactEmail =
    process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() ||
    salesEmail ||
    "contact@hrmanagement.local";

  const trialRaw = process.env.NEXT_PUBLIC_PRICING_TRIAL_DAYS ?? "14";
  const trialParsed = Number.parseInt(trialRaw, 10);
  const trialDays =
    Number.isFinite(trialParsed) && trialParsed >= 0 && trialParsed <= 730
      ? trialParsed
      : 14;

  const stripeCheckoutEnabled = isStripeCheckoutEnabled();

  return (
    <LandingView
      stripePriceIds={stripePriceIds}
      salesEmail={salesEmail}
      trialDays={trialDays}
      contactEmail={contactEmail}
      stripeCheckoutEnabled={stripeCheckoutEnabled}
    />
  );
}
