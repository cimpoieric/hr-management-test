/**
 * Logica de status pentru documente — pure functions (no DB).
 *
 * Statusuri:
 *   VALID         — document în termen valabil
 *   EXPIRING_SOON — expiră în următoarele 30 zile
 *   EXPIRED       — data expirării a trecut
 *   PENDING       — fără dată de expirare setată
 *
 * NOTA: Doar funcții pure fără acces la Prisma.
 * Pentru operații cu DB, folosește documentStatus.server.ts
 */

export type DocumentStatus = "VALID" | "EXPIRING_SOON" | "EXPIRED" | "PENDING";

/**
 * Calculează statusul unui document bazat pe expiryDate.
 * Funcție pură — poate fi folosită în client sau server.
 */
export function calculateStatus(
  expiryDate: Date | null | undefined
): DocumentStatus {
  if (!expiryDate) return "PENDING";

  const now = new Date();
  const expiry = new Date(expiryDate);

  // Resetăm orele pentru comparație corectă
  now.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);

  if (expiry < now) return "EXPIRED";

  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  if (expiry <= thirtyDaysFromNow) return "EXPIRING_SOON";

  return "VALID";
}
