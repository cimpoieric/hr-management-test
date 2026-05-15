import { Prisma } from "@prisma/client";

/** Aliniat la enum-ul Prisma `SalaryType` — fără import din `@prisma/client` când clientul nu exportă enum-ul. */
export type SalaryTypeCode = "LUNAR" | "SAPTAMANAL" | "ORA";

export function parseSalaryTypeInput(value: unknown): SalaryTypeCode | null {
  if (typeof value !== "string") return null;
  const n = value.trim().toUpperCase();
  if (n === "LUNAR" || n === "SAPTAMANAL" || n === "ORA") return n;
  return null;
}

/** Sumă brută opțională: invalidă → null (nu blochează salvarea restului câmpurilor). */
export function parseSalaryAmountDecimal(
  value: unknown,
): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    const normalized: Prisma.Decimal.Value =
      typeof value === "string"
        ? value.trim().replace(",", ".")
        : (value as Prisma.Decimal.Value);
    const d = new Prisma.Decimal(normalized);
    if (d.isNegative()) return null;
    return d;
  } catch {
    return null;
  }
}

/**
 * La citire din DB (`Decimal`), agregate sau JSON → număr pentru API/export.
 * Parametrul e `unknown` ca să evite conflicte de tip între versiuni de client Prisma.
 */
export function salaryAmountToJson(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    try {
      return new Prisma.Decimal(value).toNumber();
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const d = value as { toNumber: () => number };
    if (typeof d.toNumber === "function") {
      try {
        return d.toNumber();
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Zile lucrătoare/lună folosite la plată LUNAR proporțională (lună „completă”). */
export const LUNAR_WORKING_DAYS_NORM = 21;

/**
 * Date salariale suficiente pentru export „Plată săptămânală”, aliniat la lista /angajati
 * (tip LUNAR | SAPTAMANAL | ORA + sumă > 0 + monedă nevidă), aceeași conversie Decimal ca API-ul.
 */
export function weeklyPaySalaryDataComplete(emp: {
  salaryType?: unknown;
  salaryAmount?: unknown;
  salaryCurrency?: unknown;
}): boolean {
  const type = parseSalaryTypeInput(String(emp.salaryType ?? ""));
  if (type == null) return false;
  const amount = salaryAmountToJson(emp.salaryAmount);
  const cur = String(emp.salaryCurrency ?? "").trim();
  return amount != null && amount > 0 && cur.length > 0;
}

/**
 * Total de plată după tip:
 * - ORA: unități = ore → ore × sumă
 * - SAPTAMANAL: unități = săptămâni → săptămâni × sumă (sumă = brut săptămânal)
 * - LUNAR: unități = zile lucrate → (zile / {@link LUNAR_WORKING_DAYS_NORM}) × sumă lunară
 */
export function computeWeeklyPayTotal(
  salaryType: unknown,
  units: number,
  salaryAmountRaw: unknown,
): number | null {
  if (!Number.isFinite(units) || units < 0) return null;
  const base = salaryAmountToJson(salaryAmountRaw);
  if (base == null || base <= 0) return null;
  const t = parseSalaryTypeInput(String(salaryType ?? ""));
  if (t == null) return null;
  if (t === "ORA") return Math.round(units * base * 100) / 100;
  if (t === "SAPTAMANAL") return Math.round(units * base * 100) / 100;
  if (t === "LUNAR")
    return Math.round((units / LUNAR_WORKING_DAYS_NORM) * base * 100) / 100;
  return null;
}

/**
 * Parsează valoarea trimisă la export (body): pentru LUNAR, gol → {@link LUNAR_WORKING_DAYS_NORM}.
 */
export function parseWeeklyPayUnitsFromRequest(
  raw: unknown,
  salaryType: unknown,
): number {
  const t = parseSalaryTypeInput(String(salaryType ?? ""));
  const toNum = (v: unknown): number => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v.replace(",", "."));
      return Number.isFinite(n) ? n : Number.NaN;
    }
    return Number.NaN;
  };
  const n = toNum(raw);
  if (t === "LUNAR") {
    if (raw === undefined || raw === null || raw === "")
      return LUNAR_WORKING_DAYS_NORM;
    if (Number.isFinite(n) && n >= 0) return n;
    return LUNAR_WORKING_DAYS_NORM;
  }
  if (t === "ORA" || t === "SAPTAMANAL")
    return Number.isFinite(n) && n >= 0 ? n : 0;
  return 0;
}
