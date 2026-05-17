import "server-only";

import { type AuthContext, verifyToken } from "@/lib/auth";
import {
  type RequireRoleOptions,
  UserRole,
  isJwtRoleIn,
} from "@/lib/roles";
import { ROUTES } from "@/lib/routes";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function getDashboardSession(): Promise<AuthContext | null> {
  try {
    const token = (await cookies()).get("auth-token")?.value;
    if (!token) return null;
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export async function requireDashboardSession(): Promise<AuthContext> {
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireSuperAdminSession(): Promise<AuthContext> {
  const session = await requireDashboardSession();
  guardDashboardRoles(session, [UserRole.SUPER_ADMIN], {
    superAdminBypass: false,
  });
  return session;
}

export const requireSuperAdmin = requireSuperAdminSession;

/** Audit logs UI: SUPER_ADMIN (global) sau ORG_ADMIN (firmă proprie). */
export async function requireAuditLogsViewer(): Promise<AuthContext> {
  const session = await requireDashboardSession();
  guardDashboardRoles(session, [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN], {
    superAdminBypass: false,
  });
  return session;
}

export function guardDashboardRoles(
  session: AuthContext,
  allowed: UserRole[],
  opts?: RequireRoleOptions,
): void {
  if (!isJwtRoleIn(session, allowed, opts)) {
    redirect(ROUTES.dashboard);
  }
}
