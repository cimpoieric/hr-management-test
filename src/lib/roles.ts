import { UserRole } from "@prisma/client";

export { UserRole };

const JWT_ROLE_VALUES = new Set<string>(Object.values(UserRole));

export type RequireRoleOptions = {
  superAdminBypass?: boolean;
};

export function parseJwtRole(raw: unknown): UserRole {
  const r = String(raw ?? "").trim();
  const upper = r.toUpperCase();
  if (JWT_ROLE_VALUES.has(upper)) {
    return upper as UserRole;
  }
  const lower = r.toLowerCase();
  if (lower === "admin" || lower === "administrator" || lower === "org_admin") {
    return UserRole.ORG_ADMIN;
  }
  if (lower === "super_admin") return UserRole.SUPER_ADMIN;
  if (lower === "operator") return UserRole.OPERATOR;
  if (
    lower === "employee" ||
    lower === "doar_vizualizare" ||
    lower === "vizualizare" ||
    lower === "read_only" ||
    lower === "readonly"
  ) {
    return UserRole.EMPLOYEE;
  }
  return UserRole.EMPLOYEE;
}

export function assertValidJwtRole(role: UserRole): void {
  if (!JWT_ROLE_VALUES.has(role)) {
    throw new Error("JWT invalid: unknown role");
  }
}

export const ROLES_EMPLOYEES_RW: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.OPERATOR,
  UserRole.SUPER_ADMIN,
];

export const ROLES_PAYROLL: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.SUPER_ADMIN,
];

export const ROLES_SETTINGS_ADMIN: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.SUPER_ADMIN,
];

export const WRITE_ROLES = ROLES_EMPLOYEES_RW;

export function isJwtRoleIn(
  ctx: Pick<{ role: UserRole }, "role">,
  allowed: UserRole[],
  options?: RequireRoleOptions,
): boolean {
  const bypass = options?.superAdminBypass !== false;
  if (bypass && ctx.role === UserRole.SUPER_ADMIN) return true;
  return allowed.includes(ctx.role);
}
