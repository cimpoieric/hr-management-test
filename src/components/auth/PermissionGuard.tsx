"use client";

import { useAuth } from "@/hooks/useAuth";
import {
  type RequireRoleOptions,
  type UserRole,
  isJwtRoleIn,
} from "@/lib/roles";
import type { ReactNode } from "react";

export function PermissionGuard({
  allowedRoles,
  children,
  fallback = null,
  superAdminBypass,
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
  superAdminBypass?: boolean;
}) {
  const { role, loading } = useAuth();

  if (loading) return null;
  if (!role) return fallback;
  const opts: RequireRoleOptions | undefined =
    superAdminBypass === undefined ? undefined : { superAdminBypass };
  if (!isJwtRoleIn({ role }, allowedRoles, opts)) return fallback;
  return children;
}
