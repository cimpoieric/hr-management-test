/**
 * Permisiuni pe baza rolurilor Prisma (UserRole).
 */

import { UserRole } from "./roles";

const KNOWN_ROLES = new Set<string>(Object.values(UserRole));

export function isValidRole(role: string): role is UserRole {
  return KNOWN_ROLES.has(role);
}

export function canViewSensitiveData(role: UserRole): boolean {
  return (
    role === UserRole.SUPER_ADMIN ||
    role === UserRole.ORG_ADMIN ||
    role === UserRole.OPERATOR ||
    role === UserRole.EMPLOYEE
  );
}

export function canViewIban(role: UserRole): boolean {
  return canViewSensitiveData(role);
}

export function canEditEmployee(role: UserRole): boolean {
  return (
    role === UserRole.SUPER_ADMIN ||
    role === UserRole.ORG_ADMIN ||
    role === UserRole.OPERATOR
  );
}

export function canDeleteEmployee(role: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN || role === UserRole.ORG_ADMIN;
}

export function canApproveImport(role: UserRole): boolean {
  return (
    role === UserRole.SUPER_ADMIN ||
    role === UserRole.ORG_ADMIN ||
    role === UserRole.OPERATOR
  );
}

export function canManageUsers(role: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN || role === UserRole.ORG_ADMIN;
}

export function canBackup(role: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN || role === UserRole.ORG_ADMIN;
}

export function getPermissions(role: UserRole): Record<string, boolean> {
  return {
    viewSensitiveData: canViewSensitiveData(role),
    viewIban: canViewIban(role),
    editEmployee: canEditEmployee(role),
    deleteEmployee: canDeleteEmployee(role),
    approveImport: canApproveImport(role),
    manageUsers: canManageUsers(role),
    backup: canBackup(role),
  };
}
