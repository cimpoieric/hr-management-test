export const ADMIN_API_PREFIX = "/api/admin/";
export const ADMIN_PAGE_PREFIX = "/admin";
export const SUPERADMIN_PAGE_PREFIX = "/superadmin";
export const ADMIN_PAGE_DENY_PATH = "/dashboard";

export type AdminPageAccess = "allow" | "deny";

export function isAdminApiPath(pathname: string): boolean {
  return pathname === "/api/admin" || pathname.startsWith(ADMIN_API_PREFIX);
}

export function isAdminPagePath(pathname: string): boolean {
  if (pathname === ADMIN_PAGE_PREFIX || pathname.startsWith(`${ADMIN_PAGE_PREFIX}/`)) {
    return true;
  }
  return (
    pathname === SUPERADMIN_PAGE_PREFIX ||
    pathname.startsWith(`${SUPERADMIN_PAGE_PREFIX}/`)
  );
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role === "SUPER_ADMIN";
}

export function resolveAdminPageAccess(
  pathname: string,
  role: string | null | undefined,
): AdminPageAccess {
  if (!isAdminPagePath(pathname)) return "allow";
  return isSuperAdminRole(role) ? "allow" : "deny";
}

export function resolveAdminApiAccess(
  pathname: string,
  role: string | null | undefined,
): AdminPageAccess {
  if (!isAdminApiPath(pathname)) return "allow";
  return isSuperAdminRole(role) ? "allow" : "deny";
}
