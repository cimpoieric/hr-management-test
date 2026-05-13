import { PricingCards, PricingNav } from "@/components/pricing/PricingCards";
import type { StripePriceIds } from "@/lib/pricingPlans";
import { isStripeCheckoutEnabled } from "@/lib/stripePlanEnv";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Preturi | HR Management",
  description:
    "Planuri Starter, Business, Enterprise si Custom - trial 14 zile, plata Stripe.",
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <PricingNav />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Planuri si preturi
          </h1>
          <p className="mt-3 text-base text-slate-600 sm:text-lg">
            {stripeCheckoutEnabled
              ? "Alege planul potrivit. Toate planurile cu trial de 14 zile. Plata securizata prin Stripe pentru abonamente online."
              : "Alege planul potrivit. Inregistrarea este gratuita, fara plata online."}
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-6xl">
          <PricingCards
            stripePriceIds={stripePriceIds}
            salesEmail={salesEmail}
            trialDays={trialDays}
            stripeCheckoutEnabled={stripeCheckoutEnabled}
          />
        </div>

        {stripeCheckoutEnabled ? (
          <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-slate-500">
            Pentru checkout Stripe trebuie sa fii autentificat ca{" "}
            <strong className="text-slate-700">ORG_ADMIN</strong> sau{" "}
            <strong className="text-slate-700">SUPER_ADMIN</strong>. Seteaza in
            .env.local cheiile{" "}
            <code className="rounded bg-slate-100 px-1">
              NEXT_PUBLIC_STRIPE_PRICE_*
            </code>{" "}
            (fiecare Price ID din Dashboard). Pentru Enterprise / Custom fara
            pret Stripe, foloseste{" "}
            <code className="rounded bg-slate-100 px-1">
              NEXT_PUBLIC_SALES_EMAIL
            </code>
            .
          </p>
        ) : null}
      </main>
    </div>
  );
}
