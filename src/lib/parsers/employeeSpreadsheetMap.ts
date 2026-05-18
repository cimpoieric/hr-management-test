import {
  parseExcelDate,
  parseNumeComplet,
  type ParsedEmployeeSpreadsheetRow,
} from "@/lib/parsers/employeeSpreadsheetParser";

/** Payload row for POST /api/employees/import (matches employee form sections). */
export type SpreadsheetEmployeeImportItem = {
  cnp: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  iban?: string | null;
  bankName?: string | null;
  address?: string | null;
  city?: string | null;
  companyId: number;
  position?: string | null;
  observations?: string | null;
  workNorm?: string | null;
  seriesCI?: string | null;
  numberCI?: string | null;
  status?: "ACTIVE" | "TERMINATED";
  hiredAt?: string | null;
  salaryType?: "ORA" | "LUNAR" | "SAPTAMANAL" | null;
  salaryAmount?: number | null;
  salaryCurrency?: string | null;
  paymentFrequency?: "weekly" | "monthly" | null;
  salaryStartDate?: string | null;
  sourceSheet?: string | null;
  importStatus?: "complet" | "incomplet";
  missingFields?: string[];
  nrCrtExcel?: number | null;
  bsn?: string | null;
  postedW?: string | null;
  a1?: string | null;
  decizie?: string | null;
  fisaAppPsi?: string | null;
  dataAngajareOriginala?: string | null;
  dataIncetareOriginala?: string | null;
};

const DASH = "\u2014";

function emptyToNull(value: string | undefined): string | null {
  const t = (value ?? "").trim();
  if (!t || t === DASH) return null;
  return t;
}

export { parseExcelDate } from "@/lib/parsers/employeeSpreadsheetParser";

function parseSalaryAmount(raw?: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Split CI cell into series + number when possible (e.g. "AB 123456"). */
export function parseCiDocument(ci: string | undefined): {
  seriesCI: string | null;
  numberCI: string | null;
} {
  const t = (ci ?? "").trim();
  if (!t || t === DASH) return { seriesCI: null, numberCI: null };

  const m = t.match(/^([A-Za-z]{1,3})\s*([0-9]{4,10})$/);
  if (m) {
    return { seriesCI: m[1]!.toUpperCase(), numberCI: m[2]! };
  }

  if (/^[0-9]{4,10}$/.test(t)) {
    return { seriesCI: null, numberCI: t };
  }

  return { seriesCI: null, numberCI: t };
}

type ObservatiiParts = {
  bsn?: string;
  postedW?: string;
  a1?: string;
  contract?: string;
  decision?: string;
  ciDocument?: string;
  fisaAppPsi?: string;
  terminationDate?: string;
  rowNumber?: string;
  sourceSheet?: string;
};

/** Contract / Excel metadata lines for observations field. */
export function buildObservatii(parts: ObservatiiParts): string | null {
  const lines: string[] = [];

  if (parts.sourceSheet) {
    lines.push(`Foaie Excel: ${parts.sourceSheet}`);
  }
  if (parts.rowNumber) lines.push(`Nr. crt.: ${parts.rowNumber}`);
  if (parts.bsn) lines.push(`BSN: ${parts.bsn}`);
  if (parts.postedW) lines.push(`Posted W: ${parts.postedW}`);
  if (parts.a1) lines.push(`A1: ${parts.a1}`);
  if (parts.contract) lines.push(`Cont: ${parts.contract}`);
  if (parts.decision) lines.push(`Decizie: ${parts.decision}`);
  if (parts.ciDocument) lines.push(`CI: ${parts.ciDocument}`);
  if (parts.fisaAppPsi) lines.push(`Fisa APP+PSI: ${parts.fisaAppPsi}`);
  if (parts.terminationDate) {
    lines.push(`Data incetare: ${parts.terminationDate}`);
  }

  return lines.length > 0 ? lines.join(" | ") : null;
}

/**
 * Map parsed spreadsheet row ? employee import item (form + DB fields).
 */
export function mapSpreadsheetRowToImportItem(
  row: ParsedEmployeeSpreadsheetRow,
  companyId: number,
): SpreadsheetEmployeeImportItem {
  const lastNameRaw = row.lastName === DASH ? "" : row.lastName.trim();
  const firstNameRaw = row.firstName === DASH ? "" : row.firstName.trim();

  let lastName = lastNameRaw;
  let firstName = firstNameRaw;
  if (lastName && !firstName) {
    const split = parseNumeComplet(lastName);
    lastName = split.nume;
    firstName = split.prenume;
  }

  const hiredAt =
    parseExcelDate(row.hiredAt) ?? emptyToNull(row.hiredAt ?? undefined);
  const terminationDate =
    parseExcelDate(row.terminationDate) ??
    emptyToNull(row.terminationDate ?? undefined);

  const { seriesCI, numberCI } = parseCiDocument(row.ciDocument);

  const postedWVal = emptyToNull(row.workNorm);
  const salaryAmount = parseSalaryAmount(row.salary);
  const nrCrtExcel = (() => {
    const n = Number.parseInt(String(row.rowNumber ?? "").replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  })();

  const observations = buildObservatii({
    sourceSheet: row.sourceSheet,
    rowNumber: emptyToNull(row.rowNumber) ?? undefined,
    bsn: emptyToNull(row.bsn) ?? undefined,
    a1: emptyToNull(row.a1) ?? undefined,
    contract: emptyToNull(row.contract) ?? undefined,
    decision: emptyToNull(row.decision) ?? undefined,
    ciDocument:
      !seriesCI && !numberCI
        ? emptyToNull(row.ciDocument) ?? undefined
        : undefined,
    fisaAppPsi: emptyToNull(row.fisaAppPsi) ?? undefined,
    terminationDate: terminationDate ?? undefined,
  });

  return {
    cnp: row.cnp.replace(/\D/g, ""),
    firstName,
    lastName: lastName || firstName || "Necunoscut",
    email: emptyToNull(row.email),
    phone: emptyToNull(row.phone),
    iban: emptyToNull(row.iban),
    bankName: emptyToNull(row.bankName),
    address: emptyToNull(row.address),
    city: emptyToNull(row.city),
    companyId,
    position: emptyToNull(row.position),
    workNorm: postedWVal,
    seriesCI,
    numberCI,
    status: terminationDate ? "TERMINATED" : "ACTIVE",
    hiredAt,
    salaryType: salaryAmount != null ? "ORA" : null,
    salaryAmount,
    salaryCurrency: salaryAmount != null ? "EUR" : null,
    paymentFrequency: salaryAmount != null ? "weekly" : null,
    salaryStartDate: hiredAt,
    observations,
    sourceSheet: row.sourceSheet ?? null,
    nrCrtExcel,
    bsn: emptyToNull(row.bsn),
    postedW: postedWVal,
    a1: emptyToNull(row.a1),
    decizie: emptyToNull(row.decision),
    fisaAppPsi: emptyToNull(row.fisaAppPsi),
    dataAngajareOriginala: hiredAt,
    dataIncetareOriginala:
      terminationDate ?? emptyToNull(row.terminationDate ?? undefined),
  };
}
