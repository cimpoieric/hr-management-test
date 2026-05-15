/**
 * Clasificare documente după dată expirare (UI listă, badge-uri, filtre).
 * Folosește miezul zilei local pentru comparații calendaristice.
 */

export type DocumentExpiryBucket =
  | "expired"
  | "expiring_soon"
  | "valid"
  | "pending";

function startOfLocalDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function parseExpiryMs(expiryIso: string | null | undefined): number | null {
  if (expiryIso == null || expiryIso === "") return null;
  const t = new Date(expiryIso).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Document „expirat”: dată depășită (prioritar) sau status EXPIRED în DB. */
export function isDocumentExpired(
  status: string,
  expiryIso: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const exp = parseExpiryMs(expiryIso);
  if (exp != null && startOfLocalDay(new Date(exp)) < startOfLocalDay(now)) {
    return true;
  }
  return status === "EXPIRED";
}

/** Expiră în intervalul [azi, azi + expiringSoonDays] (inclusiv capătul). */
export function isDocumentExpiringSoon(
  status: string,
  expiryIso: string | null | undefined,
  expiringSoonDays: number,
  now: Date = new Date(),
): boolean {
  if (isDocumentExpired(status, expiryIso, now)) return false;
  const exp = parseExpiryMs(expiryIso);
  if (exp == null) return false;
  const expDay = startOfLocalDay(new Date(exp));
  const today = startOfLocalDay(now);
  if (expDay < today) return false;
  const end = new Date(today);
  end.setDate(end.getDate() + expiringSoonDays);
  const endMs = end.getTime();
  return expDay <= endMs;
}

export function getDocumentExpiryBucket(
  status: string,
  expiryIso: string | null | undefined,
  expiringSoonDays: number,
  now: Date = new Date(),
): DocumentExpiryBucket {
  if (isDocumentExpired(status, expiryIso, now)) return "expired";
  if (status === "PENDING") return "pending";
  if (isDocumentExpiringSoon(status, expiryIso, expiringSoonDays, now)) {
    return "expiring_soon";
  }
  return "valid";
}

export function countExpiryInDocuments<
  T extends { status: string; expiryDate: string | null },
>(
  docs: T[],
  expiringSoonDays: number,
  now: Date = new Date(),
): {
  expired: number;
  expiringSoon: number;
  valid: number;
  pending: number;
} {
  let expired = 0;
  let expiringSoon = 0;
  let valid = 0;
  let pending = 0;
  for (const d of docs) {
    const b = getDocumentExpiryBucket(
      d.status,
      d.expiryDate,
      expiringSoonDays,
      now,
    );
    if (b === "expired") expired++;
    else if (b === "expiring_soon") expiringSoon++;
    else if (b === "pending") pending++;
    else valid++;
  }
  return { expired, expiringSoon, valid, pending };
}
