/**
 * Shared helpers for comparing CIM extraction with existing employee (UI + API).
 */

export const CIM_NOT_FOUND = "Nu g\u0103sit \u00een document";
export const CIM_SALARY_INCOMPLETE = "Necompletat \u00een document";

export function isCimPlaceholder(value: string | undefined): boolean {
  const t = value?.trim() ?? "";
  return t === CIM_NOT_FOUND || t === CIM_SALARY_INCOMPLETE;
}

export function parseCimDateToUtcDate(value: string | undefined): Date | null {
  const t = value?.trim() ?? "";
  if (!t || isCimPlaceholder(t)) return null;
  const dmy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  if (dmy) {
    const d = Number.parseInt(dmy[1]!, 10);
    const m = Number.parseInt(dmy[2]!, 10) - 1;
    const y = Number.parseInt(dmy[3]!, 10);
    const dt = new Date(Date.UTC(y, m, d));
    return isNaN(dt.getTime()) ? null : dt;
  }
  const iso = new Date(t);
  return isNaN(iso.getTime()) ? null : iso;
}

export function formatDateDotRo(d: Date | string | null | undefined): string {
  if (d == null) return "\u2014";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "\u2014";
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = dt.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function utcDateKey(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return null;
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
