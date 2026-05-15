import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  organizationFindMany: vi.fn(),
  organizationFindUnique: vi.fn(),
  organizationUpdate: vi.fn(),
  organizationDelete: vi.fn(),
  userFindMany: vi.fn(),
  planFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prismaBase: {
    organization: {
      findMany: prismaMocks.organizationFindMany,
      findUnique: prismaMocks.organizationFindUnique,
      update: prismaMocks.organizationUpdate,
      delete: prismaMocks.organizationDelete,
    },
    user: {
      findMany: prismaMocks.userFindMany,
    },
    plan: {
      findUnique: prismaMocks.planFindUnique,
    },
  },
}));

vi.mock("@/lib/organizationPlan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./organizationPlan")>();
  return {
    ...actual,
    resolvePlanIdByKey: vi.fn().mockResolvedValue("plan-id-business"),
  };
});

import {
  deleteAdminOrganization,
  listAdminOrganizations,
  organizationPlanStatusUpdateSchema,
  updateAdminOrganizationPlanStatus,
} from "./adminOrganizations";

describe("organizationPlanStatusUpdateSchema", () => {
  it("accepts plan updates", () => {
    const parsed = organizationPlanStatusUpdateSchema.safeParse({
      plan: "business",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts status updates", () => {
    const parsed = organizationPlanStatusUpdateSchema.safeParse({
      status: "suspended",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty payloads", () => {
    const parsed = organizationPlanStatusUpdateSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });
});

describe("listAdminOrganizations", () => {
  beforeEach(() => {
    prismaMocks.organizationFindMany.mockReset();
  });

  it("returns mapped organizations with admin and counts", async () => {
    prismaMocks.organizationFindMany.mockResolvedValue([
      {
        id: "org-1",
        name: "Acme",
        slug: "acme",
        status: "active",
        subscriptionStatus: "active",
        trialEndsAt: null,
        employeeCount: 12,
        plan: { name: "BUSINESS" },
        email: "contact@acme.test",
        createdAt: new Date("2026-05-13T10:00:00.000Z"),
        users: [{ email: "admin@acme.test", name: "Admin" }],
        _count: { employees: 12, documents: 3, users: 4 },
      },
    ]);

    await expect(listAdminOrganizations()).resolves.toEqual([
      {
        id: "org-1",
        name: "Acme",
        slug: "acme",
        status: "active",
        subscriptionStatus: "active",
        trialEndsAt: null,
        plan: "business",
        email: "contact@acme.test",
        adminEmail: "admin@acme.test",
        adminUsers: [{ email: "admin@acme.test", name: "Admin" }],
        employeeCount: 12,
        documentCount: 3,
        userCount: 4,
        createdAt: "2026-05-13T10:00:00.000Z",
      },
    ]);
  });

  it("applies search, status, and plan filters", async () => {
    prismaMocks.organizationFindMany.mockResolvedValue([]);

    await listAdminOrganizations({
      search: "acme",
      status: "trial",
      plan: "starter",
    });

    expect(prismaMocks.organizationFindMany).toHaveBeenCalledWith({
      where: {
        status: "trial",
        plan: { name: "STARTER" },
        OR: [{ name: { contains: "acme" } }, { slug: { contains: "acme" } }],
      },
      orderBy: { createdAt: "desc" },
      include: expect.any(Object),
    });
  });
});

describe("updateAdminOrganizationPlanStatus", () => {
  beforeEach(() => {
    prismaMocks.organizationUpdate.mockReset();
    prismaMocks.organizationFindUnique.mockReset();
    prismaMocks.userFindMany.mockReset();
  });

  it("updates only plan and status", async () => {
    prismaMocks.organizationUpdate.mockResolvedValue({});
    prismaMocks.organizationFindUnique.mockResolvedValue({
      id: "org-1",
      name: "Acme",
      slug: "acme",
      status: "active",
      subscriptionStatus: "active",
      trialEndsAt: null,
      employeeCount: 0,
      plan: { name: "BUSINESS" },
      email: null,
      createdAt: new Date("2026-05-13T10:00:00.000Z"),
      users: [],
      _count: { employees: 0, documents: 0, users: 0 },
    });
    prismaMocks.userFindMany.mockResolvedValue([]);

    await updateAdminOrganizationPlanStatus("org-1", {
      plan: "business",
      status: "active",
    });

    expect(prismaMocks.organizationUpdate).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { planId: "plan-id-business", status: "active" },
    });
  });
});

describe("deleteAdminOrganization", () => {
  beforeEach(() => {
    prismaMocks.organizationFindUnique.mockReset();
    prismaMocks.organizationDelete.mockReset();
  });

  it("deletes organizations regardless of status", async () => {
    prismaMocks.organizationFindUnique.mockResolvedValue({
      id: "org-1",
      name: "Acme",
      slug: "acme",
      status: "trial",
      subscriptionStatus: "trial",
      trialEndsAt: null,
      employeeCount: 0,
      plan: { name: "STARTER" },
      email: null,
      createdAt: new Date("2026-05-13T10:00:00.000Z"),
      users: [],
      _count: { employees: 0, documents: 0, users: 0 },
    });

    await expect(deleteAdminOrganization("org-1")).resolves.toEqual({
      ok: true,
      organization: expect.objectContaining({ id: "org-1", status: "trial" }),
    });
    expect(prismaMocks.organizationDelete).toHaveBeenCalledWith({
      where: { id: "org-1" },
    });
  });

  it("deletes active organizations", async () => {
    prismaMocks.organizationFindUnique.mockResolvedValue({
      id: "org-1",
      name: "Acme",
      slug: "acme",
      status: "active",
      subscriptionStatus: "active",
      trialEndsAt: null,
      employeeCount: 0,
      plan: { name: "STARTER" },
      email: null,
      createdAt: new Date("2026-05-13T10:00:00.000Z"),
      users: [],
      _count: { employees: 0, documents: 0, users: 0 },
    });

    await expect(deleteAdminOrganization("org-1")).resolves.toEqual({
      ok: true,
      organization: expect.objectContaining({ id: "org-1", status: "active" }),
    });
  });
});
