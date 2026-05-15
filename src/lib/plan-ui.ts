import { FEATURES, type PlanFeature, type PlanName } from "@/lib/plan-features";

/** Plan minim recomandat pentru afisare in UI (backend ramane sursa adevarului). */
export const FEATURE_MIN_PLAN: Record<string, PlanName> = {
  [FEATURES.EXPORT_PDF]: "BUSINESS",
  [FEATURES.PAYROLL_SLIPS]: "BUSINESS",
  [FEATURES.AUTO_BACKUP]: "BUSINESS",
  [FEATURES.PRIORITY_SUPPORT]: "BUSINESS",
  [FEATURES.ADVANCED_REPORTS]: "ENTERPRISE",
  [FEATURES.API_ACCESS]: "ENTERPRISE",
  [FEATURES.CUSTOM_BRANDING]: "ENTERPRISE",
  [FEATURES.PHONE_SUPPORT]: "ENTERPRISE",
};

export function minPlanForFeature(feature: PlanFeature | string): PlanName {
  return FEATURE_MIN_PLAN[feature] ?? "BUSINESS";
}

export function clientCanUseFeature(
  features: string[],
  feature: PlanFeature | string,
): boolean {
  if (features.includes(FEATURES.UNLIMITED) || features.includes("all")) {
    return true;
  }
  return features.includes(feature);
}

export const PLAN_BADGE_STYLES: Record<
  PlanName,
  { bg: string; text: string; border: string }
> = {
  STARTER: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
  },
  BUSINESS: {
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-200",
  },
  ENTERPRISE: {
    bg: "bg-violet-50",
    text: "text-violet-800",
    border: "border-violet-200",
  },
  CUSTOM: {
    bg: "bg-amber-50",
    text: "text-amber-900",
    border: "border-amber-200",
  },
};

export function featureLabelKey(feature: PlanFeature | string): string {
  return `plan.features.${feature}`;
}
