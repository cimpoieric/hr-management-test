import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  organizationCount: vi.fn(),
  userCount: vi.fn(),
  employeeCount: vi.fn(),
  organizationGroupBy: vi.fn(),
  organizationFindMany: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prismaBase: {
    $transaction: prismaMocks.transaction,
    organization: {
      count: prismaMocks.organizationCount,
      groupBy: prismaMocks.organizationGroupBy,
      findMany: prismaMocks.organizationFindMany,
    },
    user: {
      count: prismaMocks.userCount,
      findMany: prismaMocks.userFindMany,
    },
    employee: {
      count: prismaMocks.employeeCount,
    },
  },
}));

import {
  buildOrganizationCreationSeries,
  buildRevenueBreakdown,
  getGlobalAdminStats,
} from "./adminStats";

describe("adminStats helpers", () => {
  it("builds a 30-day organization creation series", () => {
    const now = new Date("2026-05-13T12:00:00.000Z");
    const points = buildOrganizationCreationSeries(
      [new Date("2026-05-13T10:00:00.000Z"), new Date("2026-05-13T15:00:00.000Z")],
      30,
      now,
    );

    expect(points).toHaveLength(30);
    expect(points.at(-1)).toEqual({ date: "2026-05-13", count: 2 });
    expect(points.at(-2)).toEqual({ date: "2026-05-12", count: 0 });
  });

  it("estimates revenue from active and grace plans", () => {
    const result = buildRevenueBreakdown([
      { plan: "business", _count: { _all: 3 } },
      { plan: "starter", _count: { _all: 1 } },
    ]);

    expect(result.estimatedRevenueRon).toBe(496);
    expect(result.revenueBreakdown).toEqual([
      {
        plan: "business",
        count: 3,
        unitPriceRon: 149,
        subtotalRon: 447,
      },
      {
        plan: "starter",
        count: 1,
        unitPriceRon: 49,
        subtotalRon: 49,
      },
    ]);
  });
});

describe("getGlobalAdminStats", () => {
  beforeEach(() => {
    prismaMocks.transaction.mockReset();
    prismaMocks.organizationCount.mockReset();
    prismaMocks.userCount.mockReset();
    prismaMocks.employeeCount.mockReset();
    prismaMocks.organizationGroupBy.mockReset();
    prismaMocks.organizationFindMany.mockReset();
    prismaMocks.userFindMany.mockReset();
  });

  it("returns aggregated admin dashboard stats", async () => {
    prismaMocks.organizationCount
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);
    prismaMocks.userCount.mockResolvedValue(12);
    prismaMocks.employeeCount.mockResolvedValue(45);
    prismaMocks.organizationFindMany
      .mockResolvedValueOnce([
        { subscriptionPlan: { name: "BUSINESS" } },
        { subscriptionPlan: { name: "BUSINESS" } },
      ])
      .mockResolvedValueOnce([
        {
          id: "org-1",
          name: "Acme",
          slug: "acme",
          status: "trial",
          subscriptionPlan: { name: "STARTER" },
          createdAt: new Date("2026-05-13T10:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        { createdAt: new Date("2026-05-13T10:00:00.000Z") },
      ]);
    prismaMocks.userFindMany.mockResolvedValue([
      {
        id: "user-1",
        name: "Jane",
        email: "jane@example.com",
        role: "ORG_ADMIN",
        createdAt: new Date("2026-05-13T09:00:00.000Z"),
        organization: { name: "Acme" },
      },
    ]);

    prismaMocks.transaction.mockImplementation((queries) => Promise.all(queries));

    const stats = await getGlobalAdminStats();

    expect(stats.organizationCount).toBe(4);
    expect(stats.userCount).toBe(12);
    expect(stats.employeeCount).toBe(45);
    expect(stats.activeTrialCount).toBe(2);
    expect(stats.estimatedRevenueRon).toBe(298);
    expect(stats.recentOrganizations).toHaveLength(1);
    expect(stats.recentUsers[0]?.organizationName).toBe("Acme");
    expect(stats.organizationsCreatedLast30Days).toHaveLength(30);
  });
});
