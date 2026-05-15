"use client";

import { useAuthContext } from "@/components/auth/AuthProvider";
import {
  type UserRole,
  isJwtRoleIn,
  ROLES_EMPLOYEES_RW,
  ROLES_SETTINGS_ADMIN,
} from "@/lib/roles";
import { useMemo } from "react";

export type Permission =
  | "write"
  | "users:manage"
  | "employees:write"
  | "documents:write"
  | "imports:write"
  | "exports:write";

export function useAuth() {
  const { user, loading, refresh } = useAuthContext();

  const role = user?.role ?? null;

  const hasRole = (roles: UserRole[]) => {
    if (!role) return false;
    return isJwtRoleIn({ role }, roles);
  };

  const can = (permission: Permission) => {
    if (!role) return false;
    if (permission === "users:manage") {
      return isJwtRoleIn({ role }, ROLES_SETTINGS_ADMIN);
    }
    if (permission === "exports:write") {
      return isJwtRoleIn({ role }, ROLES_SETTINGS_ADMIN);
    }
    if (
      permission === "imports:write" ||
      permission === "employees:write" ||
      permission === "documents:write" ||
      permission === "write"
    ) {
      return isJwtRoleIn({ role }, ROLES_EMPLOYEES_RW);
    }
    return false;
  };

  return useMemo(
    () => ({ user, role, loading, refresh, hasRole, can }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, role, loading],
  );
}
