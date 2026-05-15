import { PricingComparison } from "@/components/pricing/PricingComparison";
import { PricingNav } from "@/components/pricing/PricingCards";
import type { StripePriceIds } from "@/lib/pricingPlans";
import { isStripeCheckoutEnabled } from "@/lib/stripePlanEnv";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Preturi | HR Management",
  description:
    "Comparatie planuri Starter, Business, Enterprise si Custom - trial 14 zile.",
};

export default function PricingPage() {
  const stripePriceIds: StripePriceIds = {
    starter: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER?.trim() ?? "",
    business: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS?.trim() ?? "",
    enterprise: process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE?.trim() ?? "",
    custom: process.env.NEXT_PUBLIC_STRIPE_PRICE_CUSTOM?.trim() ?? "",
  };

  const salesEmail = process.env.NEXT_PUBLIC_SALES_EMAIL?.trim() ?? "";

  const trialRaw = process.env.NEXT_PUBLIC_PRICING_TRIAL_DAYS ?? "14";
  const trialParsed = Number.parseInt(trialRaw, 10);
  const trialDays =
    Number.isFinite(trialParsed) && trialParsed >= 0 && trialParsed <= 730
      ? trialParsed
      : 14;

  const stripeCheckoutEnabled = isStripeCheckoutEnabled();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <PricingNav />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">
            Planuri flexibile
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Alege planul potrivit pentru firma ta
          </h1>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Comparatie clara a functionalitatilor. Trial gratuit, apoi plata
            lunara sau anuala cu 2 luni gratuite.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-[1400px]">
          <PricingComparison
            stripePriceIds={stripePriceIds}
            salesEmail={salesEmail}
            trialDays={trialDays}
            stripeCheckoutEnabled={stripeCheckoutEnabled}
          />
        </div>

        {stripeCheckoutEnabled ? (
          <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-slate-500">
            Checkout Stripe disponibil pentru administratorii organizatiei.
            Configureaza{" "}
            <code className="rounded bg-slate-100 px-1">
              NEXT_PUBLIC_STRIPE_PRICE_*
            </code>{" "}
            in .env.local.
          </p>
        ) : null}
      </main>
    </div>
  );
}
