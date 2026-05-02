/**
 * Sincronizare liste documente între file de browser și rute (ex. upload pe /angajati/[id]
 * → listă actualizată pe /documente).
 */

export const HR_DOCUMENTS_CHANGED_EVENT = "hr-documents-changed";
export const HR_DOCUMENTS_STORAGE_KEY = "hr-documents-bump";

/** Apelați după creare / ștergere document, de oriunde în client. */
export function notifyDocumentsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HR_DOCUMENTS_CHANGED_EVENT));
  try {
    localStorage.setItem(HR_DOCUMENTS_STORAGE_KEY, String(Date.now()));
  } catch {
    /* mod privat / Safari strict */
  }
}
