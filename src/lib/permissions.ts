/**
 * Sistem permisiuni bazat pe roluri.
 *
 * Roluri:
 *   administrator     — acces deplin (inclusiv gestionare utilizatori)
 *   operator          — acces operațional complet
 *   doar_vizualizare  — doar citire, fără modificări
 *
 * Niciodată nu verificăm direct `role === "ADMIN"` în componente/routes.
 * Folosim întotdeauna funcțiile de mai jos.
 */

import { UserRole } from "@/lib/auth";

/** Verifică dacă un rol este valid */
export function isValidRole(role: string): role is UserRole {
  return ["administrator", "operator", "doar_vizualizare"].includes(role);
}

/** Toți utilizatorii autentificați pot vedea datele (read-only nu blochează vizualizarea). */
export function canViewSensitiveData(role: UserRole): boolean {
  return role === "administrator" || role === "operator" || role === "doar_vizualizare";
}

/** Toți utilizatorii autentificați pot vedea IBAN-uri (doar_vizualizare e read-only). */
export function canViewIban(role: UserRole): boolean {
  return role === "administrator" || role === "operator" || role === "doar_vizualizare";
}

/** administrator, operator — pot edita angajați */
export function canEditEmployee(role: UserRole): boolean {
  return role === "administrator" || role === "operator";
}

/** administrator only — poate șterge angajați */
export function canDeleteEmployee(role: UserRole): boolean {
  return role === "administrator";
}

/** administrator, operator — pot aproba importuri bulk */
export function canApproveImport(role: UserRole): boolean {
  return role === "administrator" || role === "operator";
}

/** administrator only — poate gestiona utilizatori */
export function canManageUsers(role: UserRole): boolean {
  return role === "administrator";
}

/** administrator only — poate face backup/restore */
export function canBackup(role: UserRole): boolean {
  return role === "administrator";
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
