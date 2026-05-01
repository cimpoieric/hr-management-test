/**
 * Sistem permisiuni bazat pe roluri.
 *
 * Roluri:
 *   ADMIN      — acces deplin
 *   OPERATOR   — adăugare / editare angajați, aprobă importuri
 *   ACCOUNTING — vede IBAN-uri și date financiare
 *
 * Niciodată nu verificăm direct `role === "ADMIN"` în componente/routes.
 * Folosim întotdeauna funcțiile de mai jos.
 */

import { UserRole } from "@/lib/auth";

/** Verifică dacă un rol este valid */
export function isValidRole(role: string): role is UserRole {
  return ["ADMIN", "OPERATOR", "ACCOUNTING"].includes(role);
}

/** ADMIN, OPERATOR — pot vedea date sensibile (CNP, adresă etc.) */
export function canViewSensitiveData(role: UserRole): boolean {
  return role === "ADMIN" || role === "OPERATOR";
}

/** ADMIN, ACCOUNTING — pot vedea IBAN-uri și date bancare */
export function canViewIban(role: UserRole): boolean {
  return role === "ADMIN" || role === "ACCOUNTING";
}

/** ADMIN, OPERATOR — pot edita angajați */
export function canEditEmployee(role: UserRole): boolean {
  return role === "ADMIN" || role === "OPERATOR";
}

/** ADMIN only — poate șterge angajați */
export function canDeleteEmployee(role: UserRole): boolean {
  return role === "ADMIN";
}

/** ADMIN, OPERATOR — pot aproba importuri bulk */
export function canApproveImport(role: UserRole): boolean {
  return role === "ADMIN" || role === "OPERATOR";
}

/** ADMIN only — poate gestiona utilizatori */
export function canManageUsers(role: UserRole): boolean {
  return role === "ADMIN";
}

/** ADMIN only — poate face backup/restore */
export function canBackup(role: UserRole): boolean {
  return role === "ADMIN";
}

/** Returnează lista de permisiuni pentru un rol (util pentru debug/UI) */
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
