import type { PlanName } from "@/lib/plan-features";

export type PricingPlanId = "starter" | "business" | "enterprise" | "custom";

export type StripePriceIds = Record<PricingPlanId, string>;

export type PlanFeatureRow = {
  label: string;
  included: boolean;
};

export type PricingPlanCard = {
  id: PricingPlanId;
  name: PlanName;
  priceLeiMonthly: number;
  maxEmployees: number;
  featureRows: PlanFeatureRow[];
  cta: string;
  recommended?: boolean;
  preferContact?: boolean;
};

/** 2 luni gratuite la plata anuala = 10 luni platite / an. */
export const ANNUAL_MONTHS_PAID = 10;

export const PLAN_NAME_BY_PRICING_ID: Record<PricingPlanId, PlanName> = {
  starter: "STARTER",
  business: "BUSINESS",
  enterprise: "ENTERPRISE",
  custom: "CUSTOM",
};

export function annualTotalLei(monthlyLei: number): number {
  return monthlyLei * ANNUAL_MONTHS_PAID;
}

export function annualMonthlyEquivalentLei(monthlyLei: number): number {
  return Math.round((monthlyLei * ANNUAL_MONTHS_PAID) / 12);
}

export const PRICING_PLAN_CARDS: PricingPlanCard[] = [
  {
    id: "starter",
    name: "STARTER",
    priceLeiMonthly: 49,
    maxEmployees: 10,
    cta: "Start Trial",
    featureRows: [
      { label: "Pana la 10 angajati", included: true },
      { label: "Pontaj, documente, rapoarte de baza", included: true },
      { label: "Export Excel", included: true },
      { label: "Suport email (48h)", included: true },
      { label: "Fluturasi salarii", included: false },
      { label: "Export PDF", included: false },
      { label: "Backup automat", included: false },
      { label: "Suport prioritar", included: false },
      { label: "API access", included: false },
      { label: "Custom branding", included: false },
      { label: "Rapoarte avansate", included: false },
      { label: "Suport telefonic", included: false },
    ],
  },
  {
    id: "business",
    name: "BUSINESS",
    priceLeiMonthly: 149,
    maxEmployees: 50,
    cta: "Start Trial",
    recommended: true,
    featureRows: [
      { label: "Pana la 50 angajati", included: true },
      { label: "+ Toate de la Starter", included: true },
      { label: "Fluturasi salarii", included: true },
      { label: "Export PDF", included: true },
      { label: "Backup automat", included: true },
      { label: "Suport prioritar (24h)", included: true },
      { label: "API access", included: false },
      { label: "Custom branding", included: false },
      { label: "Rapoarte avansate", included: false },
      { label: "Suport telefonic", included: false },
    ],
  },
  {
    id: "enterprise",
    name: "ENTERPRISE",
    priceLeiMonthly: 349,
    maxEmployees: 200,
    cta: "Start Trial",
    featureRows: [
      { label: "Pana la 200 angajati", included: true },
      { label: "+ Toate de la Business", included: true },
      { label: "API access", included: true },
      { label: "Custom branding", included: true },
      { label: "Rapoarte avansate", included: true },
      { label: "Suport telefonic", included: true },
    ],
  },
  {
    id: "custom",
    name: "CUSTOM",
    priceLeiMonthly: 999,
    maxEmployees: 999_999,
    cta: "Contact Sales",
    preferContact: true,
    featureRows: [
      { label: "Angajati nelimitati", included: true },
      { label: "Server dedicat", included: true },
      { label: "Onboarding personalizat", included: true },
      { label: "Training echipa", included: true },
      { label: "SLA garantat", included: true },
      { label: "Toate functionalitatile", included: true },
    ],
  },
];

/** @deprecated Foloseste PRICING_PLAN_CARDS */
export const PRICING_PLANS = PRICING_PLAN_CARDS.map((p) => ({
  id: p.id,
  name: p.name,
  priceLei: p.priceLeiMonthly,
  priceUsdApprox: "",
  features: p.featureRows.filter((r) => r.included).map((r) => r.label),
  cta: p.cta,
  recommended: p.recommended,
  preferContactWhenNoPrice: p.preferContact,
}));
