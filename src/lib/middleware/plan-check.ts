import "server-only";

import { requireAuth, requireRole, type AuthContext } from "@/lib/auth";
import { syncExpiredTrialIfNeeded } from "@/lib/firmPlan";
import {
  PLAN_KEY_BY_NAME,
  type PlanName,
} from "@/lib/planCatalog";
import type { PlanFeature } from "@/lib/plan-features";
import { FEATURES } from "@/lib/plan-features";
import {
  assertSubscriptionActiveOrThrow,
  canUseFeature,
  getPlanLimits,
  PlanLimitError,
  type PlanLimitsInfo,
} from "@/lib/plan-limits";
import { logUsage } from "@/lib/organizationPlan";
import { prismaBase as prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/middleware/adminAccess";
import type { UserRole } from "@/lib/roles";
import { type NextRequest, NextResponse } from "next/server";

export { FEATURES } from "@/lib/plan-features";
export type { PlanFeature } from "@/lib/plan-features";

export type PlanCheckOptions = {
  feature?: PlanFeature | string;
  additionalEmployees?: number;
  roles?: UserRole[];
  superAdminBypass?: boolean;
};

export type PlanCheckSuccess = {
  allowed: true;
  user: AuthContext;
};

export type PlanCheckFailure = {
  allowed: false;
  response: NextResponse;
};

export type PlanCheckResult = PlanCheckSuccess | PlanCheckFailure;

export type PlanLimitationBody = {
  error: "Plan limitation";
  message: string;
  upgradeUrl: "/pricing";
  currentPlan: string;
  planKey: string;
  limit: string | null;
  feature: string | null;
  code: string;
};

function planKeyFromName(name: string): string {
  return PLAN_KEY_BY_NAME[name.toUpperCase() as PlanName] ?? "starter";
}

export function buildPlanLimitationResponse(
  limits: PlanLimitsInfo,
  code: "SUBSCRIPTION_INACTIVE" | "FEATURE_DENIED" | "EMPLOYEE_LIMIT",
  options?: {
    feature?: string;
    employeeCountRequested?: number;
  },
): NextResponse {
  const planKey = planKeyFromName(limits.name);
  const upgradeUrl = "/pricing" as const;

  let message: string;
  let limit: string | null = null;

  if (code === "SUBSCRIPTION_INACTIVE") {
    message =
      limits.subscriptionStatus === "expired"
        ? `Abonamentul planului ${limits.name} a expirat. Fa upgrade la ${upgradeUrl}.`
        : `Abonamentul planului ${limits.name} nu este activ. Fa upgrade la ${upgradeUrl}.`;
    limit = "Abonament activ necesar";
  } else if (code === "EMPLOYEE_LIMIT") {
    const requested = options?.employeeCountRequested ?? 1;
    const remaining = Math.max(
      0,
      limits.maxEmployees - limits.employeeCount,
    );
    message = `Ai atins limita de ${limits.maxEmployees} angajati pentru planul ${limits.name} (${limits.employeeCount} folositi, ${remaining} ramasi). Fa upgrade: ${upgradeUrl}`;
    limit = `Maxim ${limits.maxEmployees} angajati (cerere: ${requested})`;
  } else {
    const feat = options?.feature ?? "feature";
    message = `Planul ${limits.name} nu include "${feat}". Fa upgrade: ${upgradeUrl}`;
    limit = `Feature: ${feat}`;
  }

  const body: PlanLimitationBody = {
    error: "Plan limitation",
    message,
    upgradeUrl,
    currentPlan: limits.name,
    planKey,
    limit,
    feature: options?.feature ?? null,
    code,
  };

  return NextResponse.json(body, { status: 403 });
}

async function runPlanValidation(
  firmId: string,
  options: PlanCheckOptions,
): Promise<NextResponse | null> {
  await syncExpiredTrialIfNeeded(firmId);

  let limits: PlanLimitsInfo;
  try {
    limits = await getPlanLimits(firmId);
  } catch (error) {
    if (error instanceof PlanLimitError) {
      return NextResponse.json(
        {
          error: "Plan limitation",
          message: error.message,
          upgradeUrl: "/pricing",
          currentPlan: "UNKNOWN",
          planKey: "starter",
          limit: "Organizatie negasita",
          feature: null,
          code: error.code,
        } satisfies PlanLimitationBody,
        { status: 403 },
      );
    }
    throw error;
  }

  try {
    await assertSubscriptionActiveOrThrow(firmId);
  } catch {
    void logUsage(prisma, firmId, "plan:SUBSCRIPTION_INACTIVE", false).catch(
      () => undefined,
    );
    return buildPlanLimitationResponse(limits, "SUBSCRIPTION_INACTIVE");
  }

  const additional = options.additionalEmployees ?? 0;
  if (additional > 0) {
    const remaining = limits.maxEmployees - limits.employeeCount;
    if (remaining < additional) {
      void logUsage(prisma, firmId, "add_employee", false).catch(() => undefined);
      return buildPlanLimitationResponse(limits, "EMPLOYEE_LIMIT", {
        employeeCountRequested: additional,
      });
    }
    void logUsage(prisma, firmId, "add_employee", true).catch(() => undefined);
  }

  if (options.feature) {
    const allowed = await canUseFeature(firmId, options.feature);
    void logUsage(
      prisma,
      firmId,
      `feature:${options.feature}`,
      allowed,
    ).catch(() => undefined);
    if (!allowed) {
      return buildPlanLimitationResponse(limits, "FEATURE_DENIED", {
        feature: options.feature,
      });
    }
  }

  return null;
}

function resolvePlanCheckOptions(
  featureOrOptions?: PlanFeature | string | PlanCheckOptions,
  maybeOptions?: Omit<PlanCheckOptions, "feature">,
): PlanCheckOptions {
  if (
    featureOrOptions === undefined ||
    (typeof featureOrOptions === "object" &&
      ("roles" in featureOrOptions ||
        "feature" in featureOrOptions ||
        "additionalEmployees" in featureOrOptions ||
        "superAdminBypass" in featureOrOptions))
  ) {
    return (featureOrOptions as PlanCheckOptions | undefined) ?? {};
  }
  return {
    ...maybeOptions,
    feature: featureOrOptions as PlanFeature | string,
  };
}

/**
 * Verifica sesiunea, abonamentul activ si optional feature / locuri angajati.
 */
export async function checkPlan(
  request: NextRequest,
  featureOrOptions?: PlanFeature | string | PlanCheckOptions,
  maybeOptions?: Omit<PlanCheckOptions, "feature">,
): Promise<PlanCheckResult> {
  const options = resolvePlanCheckOptions(featureOrOptions, maybeOptions);
  const superAdminBypass = options.superAdminBypass !== false;

  let user: AuthContext;
  if (options.roles?.length) {
    const auth = await requireRole(request, options.roles, {
      superAdminBypass,
    });
    if (auth.response || !auth.user) {
      return {
        allowed: false,
        response:
          auth.response ??
          NextResponse.json({ error: "Neautentificat" }, { status: 401 }),
      };
    }
    user = auth.user;
  } else {
    const auth = await requireAuth(request);
    if (auth.response || !auth.user) {
      return {
        allowed: false,
        response:
          auth.response ??
          NextResponse.json({ error: "Neautentificat" }, { status: 401 }),
      };
    }
    user = auth.user;
  }

  if (superAdminBypass && isSuperAdminRole(user.role)) {
    return { allowed: true, user };
  }

  const denial = await runPlanValidation(user.organizationId, options);
  if (denial) {
    return { allowed: false, response: denial };
  }

  return { allowed: true, user };
}

/** Alias: verificare plan cu feature optional. */
export async function withPlanCheck(
  request: NextRequest,
  feature?: PlanFeature | string,
  options: Omit<PlanCheckOptions, "feature"> = {},
): Promise<PlanCheckResult> {
  return checkPlan(request, { ...options, feature });
}

/** Doar abonament activ (fara feature). */
export async function checkActiveSubscription(
  request: NextRequest,
  options: Omit<PlanCheckOptions, "feature" | "additionalEmployees"> = {},
): Promise<PlanCheckResult> {
  return checkPlan(request, options);
}

/** Verificare limita angajati. */
export async function checkCanAddEmployees(
  request: NextRequest,
  count = 1,
  options: Omit<PlanCheckOptions, "additionalEmployees"> = {},
): Promise<PlanCheckResult> {
  return checkPlan(request, { ...options, additionalEmployees: count });
}
