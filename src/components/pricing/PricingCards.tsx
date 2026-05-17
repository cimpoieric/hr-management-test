"use client";

import {
  PRICING_PLANS,
  type PricingPlanId,
  type StripePriceIds,
} from "@/lib/pricingPlans";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

const ADMIN_ROLES = new Set(["ORG_ADMIN", "SUPER_ADMIN"]);

const DEV_CHECKOUT_FOOTNOTE =
  "Configureaza Price ID in .env.local pentru checkout";

type MeResponse = {
  user?: {
    role: string;
    organizationId: string;
  };
};

function mailtoLink(email: string, subject: string): string {
  const clean = email.trim();
  return `mailto:${clean}?subject=${encodeURIComponent(subject)}`;
}

export function PricingCards(props: {
  stripePriceIds: StripePriceIds;
  salesEmail: string;
  trialDays: number;
  stripeCheckoutEnabled?: boolean;
}) {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<PricingPlanId | null>(null);

  const startStripeCheckout = useCallback(
    async (planId: PricingPlanId, priceId: string) => {
      setLoadingPlan(planId);
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        if (meRes.status === 401) {
          toast.message("Autentificare necesara", {
            description:
              "Intra in cont ca administrator al organizatiei pentru a continua plata.",
          });
          router.push(`/login?redirect=${encodeURIComponent(ROUTES.pricing)}`);
          return;
        }
        const meJson = (await meRes.json()) as MeResponse;
        const user = meJson.user;
        if (!user?.organizationId) {
          toast.error("Nu s-au putut incarca datele contului.");
          return;
        }
        if (!ADMIN_ROLES.has(user.role)) {
          toast.error(
            "Doar administratorii organizatiei pot porni checkout-ul Stripe.",
          );
          return;
        }

        const checkoutRes = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            priceId,
            organizationId: user.organizationId,
            trialPeriodDays: props.trialDays,
          }),
        });
        const checkoutJson = (await checkoutRes.json()) as {
          url?: string;
          error?: string;
        };
        if (!checkoutRes.ok || !checkoutJson.url) {
          toast.error(checkoutJson.error ?? "Checkout Stripe indisponibil.");
          return;
        }
        window.location.href = checkoutJson.url;
      } catch {
        toast.error("Eroare de retea la pornirea checkout-ului.");
      } finally {
        setLoadingPlan(null);
      }
    },
    [props.trialDays, router],
  );

  function handlePrimaryCta(planId: PricingPlanId) {
    const plan = PRICING_PLANS.find((p) => p.id === planId);
    if (!plan) return;

    if (!props.stripeCheckoutEnabled) {
      router.push("/register");
      return;
    }

    const priceId = props.stripePriceIds[planId]?.trim() ?? "";

    if (plan.preferContactWhenNoPrice && !priceId) {
      const email = props.salesEmail.trim();
      if (!email) {
        toast.error(
          "Configureaza NEXT_PUBLIC_SALES_EMAIL in .env.local pentru contact direct.",
        );
        return;
      }
      const subject =
        planId === "custom"
          ? "HR Management - demo plan Custom"
          : "HR Management - plan Enterprise";
      window.location.href = mailtoLink(email, subject);
      return;
    }

    if (!priceId) {
      toast.error(
        `Lipseste NEXT_PUBLIC_STRIPE_PRICE_${planId.toUpperCase()} in .env.local (Price ID din Stripe).`,
      );
      return;
    }

    void startStripeCheckout(planId, priceId);
  }

  return (
    <div className="mt-12 grid grid-cols-1 items-start gap-6 md:grid-cols-2 lg:grid-cols-4">
      {PRICING_PLANS.map((plan) => {
        const isLoading = loadingPlan === plan.id;
        const priceId = props.stripePriceIds[plan.id]?.trim() ?? "";
        const stripeReady =
          props.stripeCheckoutEnabled && Boolean(priceId);
        const footNote = !props.stripeCheckoutEnabled
          ? "Inregistrare gratuita, fara plata"
          : plan.preferContactWhenNoPrice
            ? stripeReady
              ? "Plata securizata prin Stripe Checkout"
              : "Contact prin email sau adauga Price ID pentru checkout online"
            : stripeReady
              ? "Plata securizata prin Stripe Checkout"
              : DEV_CHECKOUT_FOOTNOTE;
        const showFootNote = footNote !== DEV_CHECKOUT_FOOTNOTE;

        const trialLabel =
          props.trialDays > 0 ? (
            <>
              {props.trialDays} zile gratuit (trial), apoi pretul afisat
            </>
          ) : (
            <>Fara trial in Stripe la checkout (trialPeriodDays = 0)</>
          );

        const priceBlock = (
          <div className="mt-3">
            <span
              className={cn(
                "font-bold gradient-text",
                plan.recommended ? "text-5xl" : "text-4xl",
              )}
            >
              {plan.priceLei}
            </span>{" "}
            <span className="text-sm text-gray-500">LEI/ lună</span>
            {plan.priceUsdApprox ? (
              <p className="mt-1 text-sm text-gray-500">{plan.priceUsdApprox}</p>
            ) : null}
          </div>
        );

        const featuresList = (
          <ul className="mt-6 flex flex-1 flex-col space-y-3">
            {plan.features.map((f) => (
              <li key={f} className="flex gap-2">
                <Check
                  className="h-4 w-4 shrink-0 text-brand-teal"
                  aria-hidden
                />
                <span className="text-sm text-gray-300">{f}</span>
              </li>
            ))}
          </ul>
        );

        const ctaButton = (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => handlePrimaryCta(plan.id)}
            className={cn(
              "mt-8 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold transition-all disabled:opacity-60",
              plan.recommended
                ? "bg-gradient-to-r from-brand-blue to-brand-violet text-white hover:-translate-y-0.5 hover:shadow-glow-blue"
                : "glass text-white hover:bg-white/10",
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Se incarca...
              </>
            ) : (
              plan.cta
            )}
          </button>
        );

        if (plan.recommended) {
          return (
            <div
              key={plan.id}
              className="gradient-border relative rounded-2xl lg:-mt-4"
            >
              <div className="relative flex flex-col rounded-2xl bg-gradient-to-b from-brand-blue/10 to-brand-violet/5 p-6">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-blue to-brand-violet px-4 py-1 text-xs font-bold text-white">
                  RECOMANDAT
                </div>
                <h3 className="text-center text-lg font-semibold uppercase tracking-wider text-white">
                  {plan.name}
                </h3>
                <div className="text-center">{priceBlock}</div>
                <div className="text-center">
                  <p className="glass mt-3 inline-block rounded-full px-3 py-1 text-xs text-gray-300">
                    {trialLabel}
                  </p>
                </div>
                {featuresList}
                {ctaButton}
                {showFootNote ? (
                  <p className="mt-2 text-center text-[11px] text-gray-500">
                    {footNote}
                  </p>
                ) : null}
              </div>
            </div>
          );
        }

        return (
          <div
            key={plan.id}
            className="glass flex flex-col rounded-2xl p-6 transition-all duration-500 hover:-translate-y-2 hover:shadow-card-hover"
          >
            <h3 className="text-center text-lg font-semibold uppercase tracking-wider text-white">
              {plan.name}
            </h3>
            <div className="text-center">{priceBlock}</div>
            <div className="text-center">
              <p className="glass mt-3 inline-block rounded-full px-3 py-1 text-xs text-gray-300">
                {trialLabel}
              </p>
            </div>
            {featuresList}
            {ctaButton}
            {showFootNote ? (
              <p className="mt-2 text-center text-[11px] text-gray-500">
                {footNote}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function PricingNav() {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="text-lg font-bold text-slate-900">
          HR Management
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-3 text-sm">
          <Link
            href={ROUTES.pricing}
            className="font-medium text-slate-600 hover:text-slate-900"
          >
            Preturi
          </Link>
          <Link href="/login" className="text-slate-600 hover:text-slate-900">
            Autentificare
          </Link>
          <Link
            href="/register"
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            Inregistrare
          </Link>
          <Link
            href={ROUTES.dashboard}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Aplicatie
          </Link>
        </nav>
      </div>
    </header>
  );
}
