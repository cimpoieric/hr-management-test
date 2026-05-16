import "server-only";

import {
  defaultTrialEndsAt,
  PLAN_KEY_BY_NAME,
  resolvePlanIdByKey,
  resolvePlanIdByName,
  TRIAL_DAYS_DEFAULT,
  type PlanName,
} from "@/lib/planCatalog";
import {
  getPlanLimits,
  getRemainingEmployees,
  isSubscriptionUsable,
  resolveEffectiveFeatures,
} from "@/lib/plan-limits";
import { planKeyFromPlanName } from "@/lib/organizationPlan";
import type { PricingPlanId } from "@/lib/pricingPlans";
import { prismaBase as prisma } from "@/lib/prisma";

export const TRIAL_ENDING_DAYS = 3;

const orgBillingSelect = {
  id: true,
  name: true,
  status: true,
  employeeCount: true,
  subscriptionStatus: true,
  trialEndsAt: true,
  featuresOverride: true,
  planId: true,
  plan: {
    select: {
      id: true,
      name: true,
      priceLei: true,
      maxEmployees: true,
      features: true,
    },
  },
} as const;

export type FirmPlanSummary = {
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

export type FirmUsageSummary = {
  employees: number;
  documents: number;
  users: number;
  pendingImports: number;
  payslips: number;
  timesheets: number;
  usageByAction: Array<{ action: string; total: number; allowed: number; denied: number }>;
  reportsGenerated: number;
};

/** Sync trial -> expired when past trialEndsAt. Returns true if marked expired. */
export async function syncExpiredTrialIfNeeded(
  organizationId: string,
): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      subscriptionStatus: true,
      trialEndsAt: true,
    },
  });
  if (!org) return false;

  const trialExpired =
    org.subscriptionStatus === "trial" &&
    org.trialEndsAt != null &&
    org.trialEndsAt.getTime() <= Date.now();

  if (!trialExpired) return false;

  await prisma.organization.update({
    where: { id: organizationId },
    data: { subscriptionStatus: "expired" },
  });
  return true;
}

function trialDaysRemaining(trialEndsAt: Date | null): number | null {
  if (!trialEndsAt) return null;
  const ms = trialEndsAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function isTrialEndingSoon(trialEndsAt: Date | null): boolean {
  const days = trialDaysRemaining(trialEndsAt);
  if (days == null) return false;
  return days <= TRIAL_ENDING_DAYS && days >= 0;
}

export async function getFirmPlanSummary(
  organizationId: string,
): Promise<FirmPlanSummary> {
  await syncExpiredTrialIfNeeded(organizationId);

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: orgBillingSelect,
  });
  if (!org) {
    throw new Error("Organization not found");
  }

  const limits = await getPlanLimits(organizationId);
  const remaining = await getRemainingEmployees(organizationId);
  const planName = org.plan.name as PlanName;
  const planKey = planKeyFromPlanName(planName);

  return {
    organizationId: org.id,
    organizationName: org.name,
    planId: org.planId,
    planName,
    planKey,
    priceLei: org.plan.priceLei,
    maxEmployees: org.plan.maxEmployees,
    features: org.plan.features,
    effectiveFeatures: limits.effectiveFeatures,
    employeeCount: org.employeeCount,
    remainingEmployees: remaining,
    subscriptionStatus: org.subscriptionStatus,
    status: org.status,
    trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
    trialDaysRemaining: trialDaysRemaining(org.trialEndsAt),
    isSubscriptionActive: isSubscriptionUsable(org),
    isTrialEndingSoon: isTrialEndingSoon(org.trialEndsAt),
  };
}

export async function upgradeFirmPlan(
  organizationId: string,
  targetPlan: PlanName,
): Promise<FirmPlanSummary> {
  const plan = await prisma.plan.findUnique({ where: { name: targetPlan } });
  if (!plan) {
    throw new Error(`Plan ${targetPlan} not found`);
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      planId: plan.id,
      subscriptionStatus: "active",
      status: "active",
    },
  });

  return getFirmPlanSummary(organizationId);
}

export async function startFirmTrial(
  organizationId: string,
  options?: { trialPlan?: PlanName },
): Promise<FirmPlanSummary> {
  const trialPlan = options?.trialPlan ?? "BUSINESS";
  const planId = await resolvePlanIdByName(prisma, trialPlan);
  const trialEndsAt = defaultTrialEndsAt();

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      planId,
      subscriptionStatus: "trial",
      status: "trial",
      trialEndsAt,
    },
  });

  return getFirmPlanSummary(organizationId);
}

export async function getFirmUsageSummary(
  organizationId: string,
): Promise<FirmUsageSummary> {
  const [
    employees,
    documents,
    users,
    pendingImports,
    payslips,
    timesheets,
    usageGroups,
    reportsGenerated,
  ] = await Promise.all([
    prisma.employee.count({ where: { organizationId } }),
    prisma.document.count({ where: { organizationId } }),
    prisma.user.count({ where: { organizationId } }),
    prisma.pendingImport.count({
      where: { organizationId, status: "PENDING" },
    }),
    prisma.payslip.count({ where: { organizationId } }),
    prisma.timesheet.count({ where: { organizationId } }),
    prisma.usageLog.groupBy({
      by: ["action", "allowed"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.usageLog.count({
      where: {
        organizationId,
        action: { startsWith: "feature:" },
      },
    }),
  ]);

  const byAction = new Map<
    string,
    { total: number; allowed: number; denied: number }
  >();

  for (const row of usageGroups) {
    const entry = byAction.get(row.action) ?? {
      total: 0,
      allowed: 0,
      denied: 0,
    };
    const n = row._count._all;
    entry.total += n;
    if (row.allowed) entry.allowed += n;
    else entry.denied += n;
    byAction.set(row.action, entry);
  }

  return {
    employees,
    documents,
    users,
    pendingImports,
    payslips,
    timesheets,
    usageByAction: Array.from(byAction.entries()).map(([action, stats]) => ({
      action,
      ...stats,
    })),
    reportsGenerated,
  };
}

export type AdminFirmPlanOverrideInput = {
  plan?: PricingPlanId;
  subscriptionStatus?: "active" | "trial" | "expired";
  trialEndsAt?: string | null;
  status?: "active" | "suspended" | "trial" | "grace";
  featuresOverride?: string | null;
  employeeCount?: number;
};

export async function adminOverrideFirmPlan(
  organizationId: string,
  input: AdminFirmPlanOverrideInput,
): Promise<FirmPlanSummary> {
  const planId =
    input.plan !== undefined
      ? await resolvePlanIdByKey(prisma, input.plan)
      : undefined;

  let trialEndsAt: Date | null | undefined;
  if (input.trialEndsAt !== undefined) {
    if (input.trialEndsAt === null || input.trialEndsAt === "") {
      trialEndsAt = null;
    } else {
      const parsed = new Date(input.trialEndsAt);
      trialEndsAt = Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      ...(planId !== undefined ? { planId } : {}),
      ...(input.subscriptionStatus !== undefined
        ? { subscriptionStatus: input.subscriptionStatus }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(trialEndsAt !== undefined ? { trialEndsAt } : {}),
      ...(input.featuresOverride !== undefined
        ? { featuresOverride: input.featuresOverride }
        : {}),
      ...(input.employeeCount !== undefined
        ? { employeeCount: input.employeeCount }
        : {}),
    },
  });

  return getFirmPlanSummary(organizationId);
}

export { TRIAL_DAYS_DEFAULT, PLAN_KEY_BY_NAME, resolveEffectiveFeatures };
