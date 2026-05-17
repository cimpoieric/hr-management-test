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

const AUDIT_LOGS_PAGE =
  "/superadmin/audit-logs";

export function isAuditLogsPagePath(pathname: string): boolean {
  return (
    pathname === AUDIT_LOGS_PAGE ||
    pathname.startsWith(`${AUDIT_LOGS_PAGE}/`)
  );
}

export function resolveAdminPageAccess(
  pathname: string,
  role: string | null | undefined,
): AdminPageAccess {
  if (!isAdminPagePath(pathname)) return "allow";
  if (isAuditLogsPagePath(pathname)) {
    return role === "SUPER_ADMIN" || role === "ORG_ADMIN" ? "allow" : "deny";
  }
  return isSuperAdminRole(role) ? "allow" : "deny";
}

export function isGdprRequestsApiPath(pathname: string): boolean {
  return (
    pathname === "/api/admin/gdpr-requests" ||
    pathname.startsWith("/api/admin/gdpr-requests/")
  );
}

export function resolveAdminApiAccess(
  pathname: string,
  role: string | null | undefined,
): AdminPageAccess {
  if (!isAdminApiPath(pathname)) return "allow";
  if (isGdprRequestsApiPath(pathname)) {
    return role === "SUPER_ADMIN" || role === "ORG_ADMIN" ? "allow" : "deny";
  }
  return isSuperAdminRole(role) ? "allow" : "deny";
}
