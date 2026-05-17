import "server-only";

import { UserRole } from "@/lib/roles";

export const PROTECTED_SUPER_ADMIN_EMAIL = "fixautoglobal@gmail.com";
export const PLATFORM_ORGANIZATION_SLUG = "platform-system";

export const SUPER_ADMIN_DELETE_FORBIDDEN_MESSAGE =
  "Contul Super Administrator nu poate fi sters";

export const PRIMARY_SUPER_ADMIN_DELETE_FORBIDDEN_MESSAGE =
  "Contul Super Administrator principal nu poate fi sters";

export type UserDeletionTarget = {
  role: string;
  email: string;
};

export function isProtectedSuperAdminUser(user: UserDeletionTarget): boolean {
  return getSuperAdminDeletionBlockReason(user) != null;
}

export function getSuperAdminDeletionBlockReason(
  user: UserDeletionTarget,
): string | null {
  const email = user.email.trim().toLowerCase();
  if (email === PROTECTED_SUPER_ADMIN_EMAIL.toLowerCase()) {
    return PRIMARY_SUPER_ADMIN_DELETE_FORBIDDEN_MESSAGE;
  }
  if (user.role === UserRole.SUPER_ADMIN || user.role === "SUPER_ADMIN") {
    return SUPER_ADMIN_DELETE_FORBIDDEN_MESSAGE;
  }
  return null;
}

export function isProtectedPlatformOrganization(org: {
  slug: string;
}): boolean {
  return org.slug === PLATFORM_ORGANIZATION_SLUG;
}
