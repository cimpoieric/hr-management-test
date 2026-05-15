import type { PlanName } from "@/lib/plan-features";
import type { PricingPlanId } from "@/lib/pricingPlans";

/** Raspuns GET /api/firm/plan (subset folosit in UI). */
export type FirmPlanApiSummary = {
  organizationId: string;
  organizationName: string;
  planId: string;
  planName: PlanName;
  planKey: PricingPlanId;
  priceLei: number;
  maxEmployees: number;
  features: string[];
  effectiveFeatures: string[];
  employeeCount: number;
  remainingEmployees: number;
  subscriptionStatus: string;
  status: string;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  isSubscriptionActive: boolean;
  isTrialEndingSoon: boolean;
};
