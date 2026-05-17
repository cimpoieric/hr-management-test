/** Client-safe helpers (no server-only). */

export const PROTECTED_SUPER_ADMIN_EMAIL = "fixautoglobal@gmail.com";

export const SUPER_ADMIN_DELETE_TOOLTIP =
  "Contul Super Administrator nu poate fi sters";

export type UserDeletionTarget = {
  role: string;
  email: string;
};

export function isProtectedSuperAdminUser(user: UserDeletionTarget): boolean {
  const email = user.email.trim().toLowerCase();
  if (email === PROTECTED_SUPER_ADMIN_EMAIL.toLowerCase()) {
    return true;
  }
  return user.role === "SUPER_ADMIN";
}
