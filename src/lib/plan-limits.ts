import "server-only";

import { FEATURES, type PlanFeature, type PlanName } from "@/lib/plan-features";
import { logUsage } from "@/lib/organizationPlan";
import { prismaBase as prisma } from "@/lib/prisma";
import type { Plan } from "@prisma/client";
import { NextResponse } from "next/server";

export type { PlanFeature, PlanName } from "@/lib/plan-features";
export { FEATURES } from "@/lib/plan-features";

export type PlanLimitsInfo = Plan & {
  employeeCount: number;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  featuresOverride: string | null;
  effectiveFeatures: string[];
};

export type PlanLimitErrorCode =
  | "SUBSCRIPTION_INACTIVE"
  | "FEATURE_DENIED"
  | "EMPLOYEE_LIMIT";

export class PlanLimitError extends Error {
  readonly code: PlanLimitErrorCode;

  constructor(message: string, code: PlanLimitErrorCode) {
    super(message);
    this.name = "PlanLimitError";
    this.code = code;
  }
}

const orgPlanSelect = {
  employeeCount: true,
  subscriptionStatus: true,
  trialEndsAt: true,
  featuresOverride: true,
  status: true,
  plan: true,
} as const;

function parseFeaturesOverride(raw: string | null): string[] | null {
  if (!raw?.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string");
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      "features" in parsed &&
      Array.isArray((parsed as { features: unknown }).features)
    ) {
      return (parsed as { features: unknown[] }).features.filter(
        (x): x is string => typeof x === "string",
      );
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveEffectiveFeatures(
  planFeatures: string[],
  featuresOverride: string | null,
): string[] {
  const override = parseFeaturesOverride(featuresOverride);
  if (override?.length) return override;
  return planFeatures;
}

function hasFeature(effectiveFeatures: string[], feature: string): boolean {
  if (
    effectiveFeatures.includes(FEATURES.UNLIMITED) ||
    effectiveFeatures.includes("all")
  ) {
    return true;
  }
  return effectiveFeatures.includes(feature);
}

export function isSubscriptionUsable(org: {
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  status: string;
}): boolean {
  if (org.status === "suspended") return false;
  if (org.subscriptionStatus === "expired") return false;
  if (org.subscriptionStatus === "active") return true;
  if (org.status === "grace") return true;
  if (org.subscriptionStatus === "trial") {
    if (!org.trialEndsAt) return true;
    return org.trialEndsAt.getTime() > Date.now();
  }
  return false;
}

async function loadOrganizationPlan(firmId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: firmId },
    select: orgPlanSelect,
  });
  if (!org) {
    throw new PlanLimitError(
      "Organizatia nu a fost gasita.",
      "SUBSCRIPTION_INACTIVE",
    );
  }
  return org;
}

/** firmId = organizationId (tenant). */
export async function getPlanLimits(firmId: string): Promise<PlanLimitsInfo> {
  const org = await loadOrganizationPlan(firmId);
  const effectiveFeatures = resolveEffectiveFeatures(
    org.plan.features,
    org.featuresOverride,
  );
  return {
    ...org.plan,
    employeeCount: org.employeeCount,
    subscriptionStatus: org.subscriptionStatus,
    trialEndsAt: org.trialEndsAt,
    featuresOverride: org.featuresOverride,
    effectiveFeatures,
  };
}

export async function assertSubscriptionActiveOrThrow(
  firmId: string,
): Promise<void> {
  const org = await loadOrganizationPlan(firmId);
  if (!isSubscriptionUsable(org)) {
    const message =
      org.subscriptionStatus === "trial" && org.trialEndsAt
        ? "Perioada de trial a expirat. Activeaza un abonament pentru a continua."
        : "Abonamentul nu este activ. Contacteaza administratorul sau fa upgrade.";
    throw new PlanLimitError(message, "SUBSCRIPTION_INACTIVE");
  }
}

export async function canAddEmployee(firmId: string): Promise<boolean> {
  try {
    await assertSubscriptionActiveOrThrow(firmId);
    const limits = await getPlanLimits(firmId);
    return limits.employeeCount < limits.maxEmployees;
  } catch {
    return false;
  }
}

export async function getRemainingEmployees(firmId: string): Promise<number> {
  const limits = await getPlanLimits(firmId);
  return Math.max(0, limits.maxEmployees - limits.employeeCount);
}

export async function canUseFeature(
  firmId: string,
  feature: PlanFeature | string,
): Promise<boolean> {
  try {
    const org = await loadOrganizationPlan(firmId);
    if (!isSubscriptionUsable(org)) return false;
    const effectiveFeatures = resolveEffectiveFeatures(
      org.plan.features,
      org.featuresOverride,
    );
    return hasFeature(effectiveFeatures, feature);
  } catch {
    return false;
  }
}

export async function checkPlanOrThrow(
  firmId: string,
  feature: PlanFeature | string,
): Promise<void> {
  await assertSubscriptionActiveOrThrow(firmId);
  const limits = await getPlanLimits(firmId);
  const allowed = hasFeature(limits.effectiveFeatures, feature);
  void logUsage(prisma, firmId, `feature:${feature}`, allowed).catch(
    () => undefined,
  );
  if (!allowed) {
    throw new PlanLimitError(
      `Functionalitatea "${feature}" nu este inclusa in planul ${limits.name}. Fa upgrade.`,
      "FEATURE_DENIED",
    );
  }
}

export function planLimitErrorResponse(error: PlanLimitError): NextResponse {
  return NextResponse.json(
    { error: error.code, message: error.message },
    { status: 403 },
  );
}

export async function assertCanAddEmployee(
  firmId: string,
  count = 1,
): Promise<NextResponse | null> {
  try {
    await assertSubscriptionActiveOrThrow(firmId);
    const limits = await getPlanLimits(firmId);
    const remaining = limits.maxEmployees - limits.employeeCount;
    if (remaining < count) {
      throw new PlanLimitError(
        `Ai atins limita de ${limits.maxEmployees} angajati pentru planul ${limits.name}. Fa upgrade.`,
        "EMPLOYEE_LIMIT",
      );
    }
    void logUsage(prisma, firmId, "add_employee", true).catch(() => undefined);
    return null;
  } catch (error) {
    if (error instanceof PlanLimitError) {
      void logUsage(
        prisma,
        firmId,
        error.code === "EMPLOYEE_LIMIT" ? "add_employee" : `plan:${error.code}`,
        false,
      ).catch(() => undefined);
      return planLimitErrorResponse(error);
    }
    throw error;
  }
}

export async function assertPlanFeature(
  firmId: string,
  feature: PlanFeature | string,
): Promise<NextResponse | null> {
  try {
    await checkPlanOrThrow(firmId, feature);
    return null;
  } catch (error) {
    if (error instanceof PlanLimitError) {
      return planLimitErrorResponse(error);
    }
    throw error;
  }
}

export async function assertTenantPlanAccess(
  firmId: string,
  options?: {
    feature?: PlanFeature | string;
    additionalEmployees?: number;
  },
): Promise<NextResponse | null> {
  if (options?.additionalEmployees && options.additionalEmployees > 0) {
    const employeeCheck = await assertCanAddEmployee(
      firmId,
      options.additionalEmployees,
    );
    if (employeeCheck) return employeeCheck;
  }

  if (options?.feature) {
    return assertPlanFeature(firmId, options.feature);
  }

  try {
    await assertSubscriptionActiveOrThrow(firmId);
    return null;
  } catch (error) {
    if (error instanceof PlanLimitError) {
      return planLimitErrorResponse(error);
    }
    throw error;
  }
}
