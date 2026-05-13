"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PRICING_PLANS,
  type PricingPlanId,
  type StripePriceIds,
} from "@/lib/pricingPlans";
import { ROUTES } from "@/lib/routes";
import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

const ADMIN_ROLES = new Set(["ORG_ADMIN", "SUPER_ADMIN"]);

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
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
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
            : "Configureaza Price ID in .env.local pentru checkout";

        return (
          <div
            key={plan.id}
            className={
              plan.recommended
                ? "relative flex flex-col rounded-2xl border-2 border-amber-400 bg-white p-6 shadow-lg ring-1 ring-amber-100"
                : "relative flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            }
          >
            {plan.recommended ? (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 border-0 bg-amber-500 px-3 text-white hover:bg-amber-500">
                RECOMANDAT
              </Badge>
            ) : null}

            <div className="mb-4 text-center">
              <h3 className="text-lg font-bold tracking-wide text-slate-900">
                {plan.name}
              </h3>
              <div className="mt-3 flex flex-col items-center gap-0.5">
                <p className="text-3xl font-bold text-slate-900">
                  {plan.priceLei}{" "}
                  <span className="text-base font-semibold text-slate-600">
                    LEI
                  </span>
                  <span className="text-base font-normal text-slate-500">
                    / luna
                  </span>
                </p>
                <p className="text-sm text-slate-500">{plan.priceUsdApprox}</p>
              </div>
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                {props.trialDays > 0 ? (
                  <>
                    {props.trialDays} zile gratuit (trial), apoi pretul afisat
                  </>
                ) : (
                  <>Fara trial in Stripe la checkout (trialPeriodDays = 0)</>
                )}
              </p>
            </div>

            <ul className="mb-6 flex flex-1 flex-col gap-2.5 text-sm text-slate-700">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                    aria-hidden
                  />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Button
              type="button"
              size="lg"
              className={
                plan.recommended
                  ? "w-full bg-amber-500 text-white hover:bg-amber-600"
                  : "w-full"
              }
              disabled={isLoading}
              onClick={() => handlePrimaryCta(plan.id)}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Se incarca...
                </>
              ) : (
                plan.cta
              )}
            </Button>

            <p className="mt-2 text-center text-[11px] text-slate-400">
              {footNote}
            </p>
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
          <Button asChild size="sm" variant="outline">
            <Link href="/register">Inregistrare</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={ROUTES.dashboard}>Aplicatie</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
