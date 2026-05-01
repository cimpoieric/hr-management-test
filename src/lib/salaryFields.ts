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
export function parseSalaryAmountDecimal(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    const d = new Prisma.Decimal(value as Prisma.Decimal.Value);
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
