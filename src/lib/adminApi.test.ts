import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const authMocks = vi.hoisted(() => ({
  requireSuperAdmin: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireSuperAdmin: authMocks.requireSuperAdmin,
}));

vi.mock("@/lib/apiErrorResponse", () => ({
  toApiErrorResponse: vi.fn(() =>
    NextResponse.json({ error: "Eroare server" }, { status: 500 }),
  ),
  forbiddenJson: vi.fn(() =>
    NextResponse.json({ error: "Forbidden" }, { status: 403 }),
  ),
  unauthorizedJson: vi.fn(() =>
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  ),
}));

import { requireAdminApi, withAdminApi } from "./adminApi";

describe("adminApi", () => {
  beforeEach(() => {
    authMocks.requireSuperAdmin.mockReset();
  });

  it("returns 403 when the caller is not SUPER_ADMIN", async () => {
    authMocks.requireSuperAdmin.mockResolvedValue({
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const auth = await requireAdminApi(
      new NextRequest("http://localhost/api/admin/stats"),
    );

    expect(auth.user).toBeNull();
    expect(auth.response?.status).toBe(403);
    await expect(auth.response?.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("returns 401 when the caller is unauthenticated", async () => {
    authMocks.requireSuperAdmin.mockResolvedValue({
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const auth = await requireAdminApi(
      new NextRequest("http://localhost/api/admin/users"),
    );

    expect(auth.response?.status).toBe(401);
  });

  it("runs the handler for SUPER_ADMIN and returns JSON", async () => {
    authMocks.requireSuperAdmin.mockResolvedValue({
      user: {
        userId: 1,
        email: "admin@example.com",
        role: "SUPER_ADMIN",
        organizationId: "org-1",
      },
      response: null,
    });

    const response = await withAdminApi(
      new NextRequest("http://localhost/api/admin/stats"),
      async () => NextResponse.json({ stats: { organizationCount: 2 } }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      stats: { organizationCount: 2 },
    });
  });

  it("maps unexpected handler errors to a JSON 500 response", async () => {
    authMocks.requireSuperAdmin.mockResolvedValue({
      user: {
        userId: 1,
        email: "admin@example.com",
        role: "SUPER_ADMIN",
        organizationId: "org-1",
      },
      response: null,
    });

    const response = await withAdminApi(
      new NextRequest("http://localhost/api/admin/stats"),
      async () => {
        throw new Error("boom");
      },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Eroare server" });
  });
});
