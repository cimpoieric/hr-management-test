import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prismaBase: {
    user: {
      findMany: prismaMocks.userFindMany,
    },
  },
}));

import { listAdminUsers } from "./adminUsers";

describe("listAdminUsers", () => {
  beforeEach(() => {
    prismaMocks.userFindMany.mockReset();
  });

  it("returns mapped users across organizations", async () => {
    prismaMocks.userFindMany.mockResolvedValue([
      {
        id: "user-1",
        name: "Jane",
        email: "jane@example.com",
        role: "ORG_ADMIN",
        organizationId: "org-1",
        isActive: true,
        createdAt: new Date("2026-05-13T10:00:00.000Z"),
        organization: { name: "Acme" },
      },
    ]);

    await expect(listAdminUsers()).resolves.toEqual([
      {
        id: "user-1",
        name: "Jane",
        email: "jane@example.com",
        role: "ORG_ADMIN",
        organizationId: "org-1",
        organizationName: "Acme",
        isActive: true,
        createdAt: "2026-05-13T10:00:00.000Z",
      },
    ]);
  });

  it("applies search, role, and organization filters", async () => {
    prismaMocks.userFindMany.mockResolvedValue([]);

    await listAdminUsers({
      search: "jane",
      role: "ORG_ADMIN",
      organizationId: "org-1",
    });

    expect(prismaMocks.userFindMany).toHaveBeenCalledWith({
      where: {
        role: "ORG_ADMIN",
        organizationId: "org-1",
        OR: [{ name: { contains: "jane" } }, { email: { contains: "jane" } }],
      },
      orderBy: { createdAt: "desc" },
      select: expect.any(Object),
    });
  });
});
