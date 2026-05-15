import { describe, expect, it } from "vitest";
import {
  ADMIN_PAGE_DENY_PATH,
  isAdminApiPath,
  isAdminPagePath,
  isSuperAdminRole,
  resolveAdminApiAccess,
  resolveAdminPageAccess,
} from "./adminAccess";

describe("adminAccess", () => {
  it("detects admin API paths", () => {
    expect(isAdminApiPath("/api/admin/stats")).toBe(true);
    expect(isAdminApiPath("/api/admin")).toBe(true);
    expect(isAdminApiPath("/api/settings")).toBe(false);
  });

  it("detects admin page paths", () => {
    expect(isAdminPagePath("/admin")).toBe(true);
    expect(isAdminPagePath("/admin/users")).toBe(true);
    expect(isAdminPagePath("/dashboard")).toBe(false);
  });

  it("accepts only SUPER_ADMIN role", () => {
    expect(isSuperAdminRole("SUPER_ADMIN")).toBe(true);
    expect(isSuperAdminRole("ORG_ADMIN")).toBe(false);
    expect(isSuperAdminRole(null)).toBe(false);
  });

  it("denies non-super-admin access to admin pages", () => {
    expect(resolveAdminPageAccess("/admin", "ORG_ADMIN")).toBe("deny");
    expect(resolveAdminPageAccess("/admin/users", "HR_MANAGER")).toBe("deny");
    expect(resolveAdminPageAccess("/admin", "SUPER_ADMIN")).toBe("allow");
    expect(resolveAdminPageAccess("/dashboard", "ORG_ADMIN")).toBe("allow");
    expect(ADMIN_PAGE_DENY_PATH).toBe("/dashboard");
  });

  it("denies non-super-admin access to admin APIs", () => {
    expect(resolveAdminApiAccess("/api/admin/stats", "ORG_ADMIN")).toBe("deny");
    expect(resolveAdminApiAccess("/api/admin/stats", "SUPER_ADMIN")).toBe("allow");
    expect(resolveAdminApiAccess("/api/employees", "ORG_ADMIN")).toBe("allow");
  });
});
