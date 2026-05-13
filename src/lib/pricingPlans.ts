export type PricingPlanId = "starter" | "business" | "enterprise" | "custom";

export type StripePriceIds = Record<PricingPlanId, string>;

export type PricingPlan = {
  id: PricingPlanId;
  name: string;
  priceLei: number;
  priceUsdApprox: string;
  features: string[];
  cta: string;
  /** When true, card is visually highlighted (recommended tier). */
  recommended?: boolean;
  /** If true, primary action uses mailto when no Stripe price id is configured. */
  preferContactWhenNoPrice?: boolean;
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "STARTER",
    priceLei: 49,
    priceUsdApprox: "~$10",
    features: [
      "Pana la 10 angajati",
      "Pontaj, documente, rapoarte de baza",
      "Export Excel",
      "Suport email (48h)",
    ],
    cta: "Start Trial",
  },
  {
    id: "business",
    name: "BUSINESS",
    priceLei: 149,
    priceUsdApprox: "~$30",
    features: [
      "Pana la 50 angajati",
      "+ Fluturasi salarii",
      "+ Export PDF",
      "+ Backup automat",
      "+ Suport prioritar (24h)",
    ],
    cta: "Start Trial",
    recommended: true,
  },
  {
    id: "enterprise",
    name: "ENTERPRISE",
    priceLei: 349,
    priceUsdApprox: "~$70",
    features: [
      "Pana la 200 angajati",
      "+ API access",
      "+ Custom branding",
      "+ Rapoarte avansate",
      "+ Suport telefonic",
    ],
    cta: "Contact Sales",
    preferContactWhenNoPrice: true,
  },
  {
    id: "custom",
    name: "CUSTOM",
    priceLei: 999,
    priceUsdApprox: "~$200",
    features: [
      "Angajati nelimitati",
      "Server dedicat",
      "Onboarding personalizat",
      "Training echipa",
      "SLA garantat",
    ],
    cta: "Book Demo",
    preferContactWhenNoPrice: true,
  },
];
