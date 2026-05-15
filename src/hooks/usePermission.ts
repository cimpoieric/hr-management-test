"use client";

import { useAuth } from "@/hooks/useAuth";
import { UserRole, isJwtRoleIn, ROLES_EMPLOYEES_RW } from "@/lib/roles";
import { useMemo } from "react";

export function useIsAdmin(): boolean {
  const { role } = useAuth();
  return useMemo(
    () =>
      Boolean(
        role &&
        isJwtRoleIn({ role }, [UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN]),
      ),
    [role],
  );
}

export function useCanView(): boolean {
  const { role } = useAuth();
  return useMemo(() => Boolean(role), [role]);
}

export function useCanEdit(): boolean {
  const { role } = useAuth();
  return useMemo(
    () => Boolean(role && isJwtRoleIn({ role }, ROLES_EMPLOYEES_RW)),
    [role],
  );
}

export function useCanApprove(): boolean {
  return useCanEdit();
}

export function useCanDelete(): boolean {
  const { role } = useAuth();
  return useMemo(
    () =>
      Boolean(
        role &&
        isJwtRoleIn({ role }, [UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN]),
      ),
    [role],
  );
}
