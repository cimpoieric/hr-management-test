import type { PlanName } from "@/lib/plan-features";
import type { PricingPlanId } from "@/lib/pricingPlans";
import type { Prisma, PrismaClient } from "@prisma/client";

export type PlanDb = PrismaClient | Prisma.TransactionClient;

export type { PlanName } from "@/lib/plan-features";

export const PLAN_NAME_BY_KEY: Record<PricingPlanId, PlanName> = {
  starter: "STARTER",
  business: "BUSINESS",
  enterprise: "ENTERPRISE",
  custom: "CUSTOM",
};

export const PLAN_KEY_BY_NAME: Record<PlanName, PricingPlanId> = {
  STARTER: "starter",
  BUSINESS: "business",
  ENTERPRISE: "enterprise",
  CUSTOM: "custom",
};

export const DEFAULT_PLAN_KEY: PricingPlanId = "starter";

export const TRIAL_DAYS_DEFAULT = 14;

const BUSINESS_FEATURES = [
  "basic_reports",
  "export_excel",
  "email_support",
  "payroll_slips",
  "export_pdf",
  "auto_backup",
  "priority_support",
] as const;

export const SEED_PLANS: Array<{
  name: PlanName;
  priceLei: number;
  maxEmployees: number;
  features: string[];
}> = [
  {
    name: "STARTER",
    priceLei: 49,
    maxEmployees: 10,
    features: ["basic_reports", "export_excel", "email_support"],
  },
  {
    name: "BUSINESS",
    priceLei: 149,
    maxEmployees: 50,
    features: [...BUSINESS_FEATURES],
  },
  {
    name: "ENTERPRISE",
    priceLei: 349,
    maxEmployees: 200,
    features: [
      ...BUSINESS_FEATURES,
      "api_access",
      "custom_branding",
      "advanced_reports",
      "phone_support",
    ],
  },
  {
    name: "CUSTOM",
    priceLei: 999,
    maxEmployees: 999_999,
    features: ["all"],
  },
];

export function planKeyFromPlanName(name: string): PricingPlanId {
  const key = PLAN_KEY_BY_NAME[name.toUpperCase() as PlanName];
  return key ?? DEFAULT_PLAN_KEY;
}

export function defaultTrialEndsAt(from = new Date()): Date {
  const end = new Date(from);
  end.setDate(end.getDate() + TRIAL_DAYS_DEFAULT);
  return end;
}

export async function seedPlans(prisma: PlanDb): Promise<void> {
  for (const row of SEED_PLANS) {
    await prisma.plan.upsert({
      where: { name: row.name },
      create: {
        name: row.name,
        priceLei: row.priceLei,
        maxEmployees: row.maxEmployees,
        features: row.features,
      },
      update: {
        priceLei: row.priceLei,
        maxEmployees: row.maxEmployees,
        features: row.features,
      },
    });
  }
}

export async function resolvePlanIdByKey(
  prisma: PlanDb,
  planKey: string,
): Promise<string> {
  const key = planKey.toLowerCase() as PricingPlanId;
  const normalized = key in PLAN_NAME_BY_KEY ? key : DEFAULT_PLAN_KEY;
  const name = PLAN_NAME_BY_KEY[normalized];
  const plan = await prisma.plan.findUnique({ where: { name } });
  if (!plan) {
    throw new Error(
      `Plan "${name}" not found. Run prisma db seed before creating organizations.`,
    );
  }
  return plan.id;
}

export async function resolvePlanIdByName(
  prisma: PlanDb,
  name: PlanName,
): Promise<string> {
  const plan = await prisma.plan.findUnique({ where: { name } });
  if (!plan) {
    throw new Error(`Plan "${name}" not found. Run prisma db seed.`);
  }
  return plan.id;
}
