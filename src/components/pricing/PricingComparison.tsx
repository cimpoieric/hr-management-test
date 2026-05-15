"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ANNUAL_MONTHS_PAID,
  annualMonthlyEquivalentLei,
  annualTotalLei,
  PLAN_NAME_BY_PRICING_ID,
  PRICING_PLAN_CARDS,
  type PricingPlanId,
  type StripePriceIds,
} from "@/lib/pricingPlans";
import { ROUTES } from "@/lib/routes";
import { Check, Loader2, Mail, X } from "lucide-react";
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
  return `mailto:${email.trim()}?subject=${encodeURIComponent(subject)}`;
}

function FeatureRow({ label, included }: { label: string; included: boolean }) {
  return (
    <li className="flex items-start gap-2 text-sm leading-snug">
      {included ? (
        <Check
          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
          aria-hidden
        />
      ) : (
        <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden />
      )}
      <span className={included ? "text-slate-700" : "text-slate-400"}>
        {label}
      </span>
    </li>
  );
}

export function PricingComparison(props: {
  stripePriceIds: StripePriceIds;
  salesEmail: string;
  trialDays: number;
  stripeCheckoutEnabled?: boolean;
}) {
  const router = useRouter();
  const [annual, setAnnual] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<PricingPlanId | null>(null);

  const startStripeCheckout = useCallback(
    async (planId: PricingPlanId, priceId: string) => {
      setLoadingPlan(planId);
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        if (meRes.status === 401) {
          toast.message("Autentificare necesara", {
            description: "Intra in cont ca administrator pentru a continua.",
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
            "Doar administratorii organizatiei pot porni trial-ul sau plata.",
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

  const startTrialWithoutStripe = useCallback(
    async (planId: PricingPlanId) => {
      setLoadingPlan(planId);
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        if (meRes.status === 401) {
          router.push(`/register?plan=${planId}`);
          return;
        }
        const meJson = (await meRes.json()) as MeResponse;
        const user = meJson.user;
        if (!user?.organizationId) {
          router.push("/register");
          return;
        }
        if (!ADMIN_ROLES.has(user.role)) {
          toast.error(
            "Doar administratorii organizatiei pot activa perioada de proba.",
          );
          return;
        }

        const trialPlan = PLAN_NAME_BY_PRICING_ID[planId];
        const res = await fetch("/api/firm/start-trial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ trialPlan }),
        });
        const data = (await res.json()) as { error?: string; message?: string };
        if (!res.ok) {
          toast.error(data.error ?? "Nu s-a putut activa trial-ul.");
          return;
        }
        toast.success(
          data.message ??
            `Trial ${props.trialDays} zile activat. Redirect catre aplicatie...`,
        );
        router.push(ROUTES.dashboard);
        router.refresh();
      } catch {
        toast.error("Eroare la activarea trial-ului.");
      } finally {
        setLoadingPlan(null);
      }
    },
    [props.trialDays, router],
  );

  const handleCta = useCallback(
    (planId: PricingPlanId) => {
      const plan = PRICING_PLAN_CARDS.find((p) => p.id === planId);
      if (!plan) return;

      if (planId === "custom") {
        const email = props.salesEmail.trim();
        if (!email) {
          toast.error("Configureaza NEXT_PUBLIC_SALES_EMAIL pentru contact.");
          return;
        }
        window.location.href = mailtoLink(
          email,
          "HR Management - plan Custom",
        );
        return;
      }

      const priceId = props.stripePriceIds[planId]?.trim() ?? "";
      if (props.stripeCheckoutEnabled && priceId) {
        void startStripeCheckout(planId, priceId);
        return;
      }

      void startTrialWithoutStripe(planId);
    },
    [
      props.salesEmail,
      props.stripeCheckoutEnabled,
      props.stripePriceIds,
      startStripeCheckout,
      startTrialWithoutStripe,
    ],
  );

  return (
    <div className="space-y-10">
      {/* Billing toggle */}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <span
          className={`text-sm font-medium ${!annual ? "text-slate-900" : "text-slate-500"}`}
        >
          Plata lunara
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          onClick={() => setAnnual((v) => !v)}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
            annual ? "bg-amber-500" : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
              annual ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
        <span
          className={`text-sm font-medium ${annual ? "text-slate-900" : "text-slate-500"}`}
        >
          Plata anuala
        </span>
        {annual ? (
          <Badge className="border-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            2 luni gratuite
          </Badge>
        ) : null}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
        {PRICING_PLAN_CARDS.map((plan) => {
          const isLoading = loadingPlan === plan.id;
          const monthly = plan.priceLeiMonthly;
          const displayMonthly = annual
            ? annualMonthlyEquivalentLei(monthly)
            : monthly;
          const annualTotal = annualTotalLei(monthly);
          const isCustom = plan.id === "custom";

          return (
            <div
              key={plan.id}
              className={
                plan.recommended
                  ? "relative flex flex-col rounded-2xl border-2 border-orange-500 bg-white p-6 shadow-lg ring-2 ring-orange-100"
                  : "relative flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              }
            >
              {plan.recommended ? (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 border-0 bg-orange-500 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-orange-500">
                  Recomandat
                </Badge>
              ) : null}

              <div className="mb-5 text-center">
                <h3 className="text-lg font-bold tracking-wide text-slate-900">
                  {plan.name}
                </h3>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-slate-900 tabular-nums">
                    {displayMonthly}
                    <span className="text-base font-semibold text-slate-600">
                      {" "}
                      LEI
                    </span>
                    <span className="text-base font-normal text-slate-500">
                      / luna
                    </span>
                  </p>
                  {annual && !isCustom ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {annualTotal} LEI/an ({ANNUAL_MONTHS_PAID} luni platite)
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">
                      {monthly} LEI/luna facturat lunar
                    </p>
                  )}
                </div>
                {!isCustom && props.trialDays > 0 ? (
                  <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                    {props.trialDays} zile trial gratuit
                  </p>
                ) : null}
              </div>

              <ul className="mb-6 flex flex-1 flex-col gap-2 border-t border-slate-100 pt-4">
                {plan.featureRows.map((row) => (
                  <FeatureRow
                    key={row.label}
                    label={row.label}
                    included={row.included}
                  />
                ))}
              </ul>

              <Button
                type="button"
                size="lg"
                className={
                  plan.recommended
                    ? "w-full bg-orange-500 text-white hover:bg-orange-600"
                    : isCustom
                      ? "w-full border-slate-300"
                      : "w-full"
                }
                variant={isCustom ? "outline" : "default"}
                disabled={isLoading}
                onClick={() => handleCta(plan.id)}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Se proceseaza...
                  </>
                ) : isCustom ? (
                  <>
                    <Mail className="h-4 w-4" />
                    {plan.cta}
                  </>
                ) : (
                  plan.cta
                )}
              </Button>

              <p className="mt-2 text-center text-[11px] text-slate-400">
                {isCustom
                  ? "Oferta personalizata"
                  : props.stripeCheckoutEnabled &&
                      props.stripePriceIds[plan.id]?.trim()
                    ? "Trial + plata securizata Stripe"
                    : "Trial activat in aplicatie (fara plata online)"}
              </p>
            </div>
          );
        })}
      </div>

      {/* Bottom banner */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-8 text-center text-white shadow-md sm:px-10">
        <p className="text-lg font-semibold">
          Ai nevoie de mai mult? Contacteaza-ne pentru planul CUSTOM.
        </p>
        <p className="mt-2 text-sm text-slate-300">
          Server dedicat, SLA, onboarding si training pentru echipe mari.
        </p>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="mt-5 border-white/30 bg-white text-slate-900 hover:bg-slate-100"
          onClick={() => handleCta("custom")}
        >
          <Mail className="h-4 w-4" />
          Contact Sales
        </Button>
      </div>
    </div>
  );
}
