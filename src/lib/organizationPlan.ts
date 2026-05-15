import "server-only";

import {
  defaultTrialEndsAt,
  planKeyFromPlanName,
  resolvePlanIdByKey,
  type PlanDb,
} from "@/lib/planCatalog";
import type { PricingPlanId } from "@/lib/pricingPlans";
import type { PrismaClient } from "@prisma/client";

export { planKeyFromPlanName, resolvePlanIdByKey, defaultTrialEndsAt };

export function organizationPlanSelect() {
  return { plan: { select: { name: true, maxEmployees: true, features: true } } };
}

export type OrganizationWithPlan = {
  planId: string;
  plan: { name: string; maxEmployees: number; features: string[] };
};

export function getOrganizationPlanKey(org: {
  plan?: { name: string } | null;
}): PricingPlanId {
  if (!org.plan?.name) return "starter";
  return planKeyFromPlanName(org.plan.name);
}

export async function buildNewOrganizationPlanData(
  prisma: PlanDb,
  planKey: string,
  options?: { trial?: boolean },
): Promise<{
  planId: string;
  subscriptionStatus: string;
  status: string;
  trialEndsAt: Date | null;
  employeeCount: number;
}> {
  const trial = options?.trial !== false;
  const planId = await resolvePlanIdByKey(prisma, planKey);
  return {
    planId,
    employeeCount: 0,
    subscriptionStatus: trial ? "trial" : "active",
    status: trial ? "trial" : "active",
    trialEndsAt: trial ? defaultTrialEndsAt() : null,
  };
}

export async function incrementOrganizationEmployeeCount(
  prisma: Pick<PrismaClient, "organization">,
  organizationId: string,
  delta = 1,
): Promise<void> {
  await prisma.organization.update({
    where: { id: organizationId },
    data: { employeeCount: { increment: delta } },
  });
}

export async function syncOrganizationEmployeeCount(
  prisma: Pick<PrismaClient, "organization" | "employee">,
  organizationId: string,
): Promise<number> {
  const count = await prisma.employee.count({ where: { organizationId } });
  await prisma.organization.update({
    where: { id: organizationId },
    data: { employeeCount: count },
  });
  return count;
}

export async function logUsage(
  prisma: Pick<PrismaClient, "usageLog">,
  organizationId: string,
  action: string,
  allowed: boolean,
): Promise<void> {
  await prisma.usageLog.create({
    data: { organizationId, action, allowed },
  });
}
