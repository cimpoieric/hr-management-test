import "server-only";

import { getOrganizationPlanKey } from "@/lib/organizationPlan";
import { type PricingPlanId, PRICING_PLANS } from "@/lib/pricingPlans";
import { prismaBase as prisma } from "@/lib/prisma";

const PLAN_PRICE_LEI: Record<PricingPlanId, number> = {
  starter: PRICING_PLANS.find((plan) => plan.id === "starter")!.priceLei,
  business: PRICING_PLANS.find((plan) => plan.id === "business")!.priceLei,
  enterprise: PRICING_PLANS.find((plan) => plan.id === "enterprise")!.priceLei,
  custom: PRICING_PLANS.find((plan) => plan.id === "custom")!.priceLei,
};

const REVENUE_STATUSES = ["active", "grace"] as const;

export type AdminRevenueBreakdownRow = {
  plan: string;
  count: number;
  unitPriceRon: number;
  subtotalRon: number;
};

export type AdminOrganizationCreationPoint = {
  date: string;
  count: number;
};

export type AdminRecentOrganization = {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  createdAt: string;
};

export type AdminRecentUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  organizationName: string;
  createdAt: string;
};

export type GlobalAdminStats = {
  organizationCount: number;
  userCount: number;
  employeeCount: number;
  activeTrialCount: number;
  estimatedRevenueRon: number;
  revenueBreakdown: AdminRevenueBreakdownRow[];
  organizationsCreatedLast30Days: AdminOrganizationCreationPoint[];
  recentOrganizations: AdminRecentOrganization[];
  recentUsers: AdminRecentUser[];
};

function planUnitPriceRon(plan: string): number {
  if (plan in PLAN_PRICE_LEI) {
    return PLAN_PRICE_LEI[plan as PricingPlanId];
  }
  return 0;
}

export function buildOrganizationCreationSeries(
  createdAtValues: Date[],
  days = 30,
  now = new Date(),
): AdminOrganizationCreationPoint[] {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (days - 1));

  const counts = new Map<string, number>();
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + offset);
    counts.set(day.toISOString().slice(0, 10), 0);
  }

  for (const createdAt of createdAtValues) {
    const key = createdAt.toISOString().slice(0, 10);
    if (!counts.has(key)) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
}

export function buildRevenueBreakdown(
  planCounts: Array<{ plan: string; _count: { _all: number } | true }>,
): { estimatedRevenueRon: number; revenueBreakdown: AdminRevenueBreakdownRow[] } {
  const revenueBreakdown = planCounts
    .map((row) => {
      const count =
        typeof row._count === "object" && row._count?._all != null
          ? row._count._all
          : 0;
      const unitPriceRon = planUnitPriceRon(row.plan);
      return {
        plan: row.plan,
        count,
        unitPriceRon,
        subtotalRon: count * unitPriceRon,
      };
    })
    .filter((row) => row.count > 0)
    .sort((left, right) => right.subtotalRon - left.subtotalRon);

  const estimatedRevenueRon = revenueBreakdown.reduce(
    (total, row) => total + row.subtotalRon,
    0,
  );

  return { estimatedRevenueRon, revenueBreakdown };
}

export async function getGlobalAdminStats(): Promise<GlobalAdminStats> {
  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - 29);
  windowStart.setUTCHours(0, 0, 0, 0);

  const [
    organizationCount,
    userCount,
    employeeCount,
    activeTrialCount,
    planCounts,
    recentOrganizations,
    recentUsers,
    organizationsInWindow,
  ] = await prisma.$transaction([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.employee.count(),
    prisma.organization.count({ where: { status: "trial" } }),
    prisma.organization.findMany({
      where: { status: { in: [...REVENUE_STATUSES] } },
      select: { subscriptionPlan: { select: { name: true } } },
    }),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        subscriptionPlan: { select: { name: true } },
        createdAt: true,
      },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        organization: {
          select: { name: true },
        },
      },
    }),
    prisma.organization.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
  ]);

  const planCountMap = new Map<string, number>();
  for (const row of planCounts) {
    const key = getOrganizationPlanKey(row);
    planCountMap.set(key, (planCountMap.get(key) ?? 0) + 1);
  }
  const planCountsForRevenue = Array.from(planCountMap.entries()).map(
    ([plan, count]) => ({
      plan,
      _count: { _all: count },
    }),
  );

  const { estimatedRevenueRon, revenueBreakdown } =
    buildRevenueBreakdown(planCountsForRevenue);

  return {
    organizationCount,
    userCount,
    employeeCount,
    activeTrialCount,
    estimatedRevenueRon,
    revenueBreakdown,
    organizationsCreatedLast30Days: buildOrganizationCreationSeries(
      organizationsInWindow.map((organization) => organization.createdAt),
    ),
    recentOrganizations: recentOrganizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
      plan: getOrganizationPlanKey(organization),
      createdAt: organization.createdAt.toISOString(),
    })),
    recentUsers: recentUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationName: user.organization.name,
      createdAt: user.createdAt.toISOString(),
    })),
  };
}
