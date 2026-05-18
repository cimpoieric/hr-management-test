import { validateCNP } from "@/lib/validation";

export type ImportRowInput = {
  cnp?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  observations?: string | null;
  [key: string]: unknown;
};

export type NormalizedImportRow = ImportRowInput & {
  firstName: string;
  lastName: string;
  cnp: string;
  cnpForStorage: string;
  cnpIsValid: boolean;
  importStatus: "complet" | "incomplet";
  missingFields: string[];
  observations: string | null;
};

const PLACEHOLDER_MARK = "IMP";

/** CNP temporar unic (13 cifre) pentru angajati importati fara CNP valid. */
export function generateImportPlaceholderCnp(
  organizationId: string,
  rowIndex: number,
): string {
  const orgPart = organizationId.replace(/\D/g, "").slice(-4).padStart(4, "0");
  const timePart = String(Date.now() % 100000).padStart(5, "0");
  const rowPart = String(rowIndex % 1000).padStart(3, "0");
  return `9${orgPart}${timePart}${rowPart}`.slice(0, 13);
}

function isEmptySpreadsheetValue(value: unknown): boolean {
  const t = String(value ?? "").trim();
  return !t || t === "\u2014" || t === "-" || t.toUpperCase() === "N/A";
}

function cleanName(value: unknown): string {
  const t = String(value ?? "").trim();
  if (isEmptySpreadsheetValue(t)) return "";
  return t;
}

/** Campuri lipsa afisate in previzualizarea importului Excel. */
export function getSpreadsheetPreviewMissingFields(row: {
  firstName?: string | null;
  lastName?: string | null;
  cnp?: string | null;
  address?: string | null;
  salary?: string | null;
}): string[] {
  const missing: string[] = [];
  if (isEmptySpreadsheetValue(row.firstName)) missing.push("Prenume");
  if (isEmptySpreadsheetValue(row.lastName)) missing.push("Nume");
  const cnpDigits = String(row.cnp ?? "").replace(/\D/g, "");
  if (!cnpDigits) missing.push("CNP");
  else if (cnpDigits.length !== 13 || !validateCNP(cnpDigits))
    missing.push("CNP (invalid)");
  if (isEmptySpreadsheetValue(row.address)) missing.push("Adresa");
  if (isEmptySpreadsheetValue(row.salary)) missing.push("Salariu");
  return missing;
}

export function appendImportMetadataToObservations(
  observations: string | null | undefined,
  importStatus: "complet" | "incomplet",
  missingFields: string[],
): string | null {
  const parts: string[] = [];
  if (importStatus === "incomplet" && missingFields.length > 0) {
    parts.push(`[Import incomplet] Lipsesc: ${missingFields.join(", ")}`);
  }
  const base = (observations ?? "").trim();
  if (base) parts.push(base);
  return parts.length > 0 ? parts.join(" | ") : null;
}

export function normalizeImportEmployeeRow(
  raw: ImportRowInput,
  rowIndex: number,
  organizationId: string,
): NormalizedImportRow {
  const missingFields: string[] = [];

  let firstName = cleanName(raw.firstName);
  let lastName = cleanName(raw.lastName);

  if (!firstName) missingFields.push("Prenume");
  if (!lastName) missingFields.push("Nume");

  const cnpDigits = String(raw.cnp ?? "").replace(/\D/g, "");
  const cnpIsValid = cnpDigits.length === 13 && validateCNP(cnpDigits);

  if (!cnpDigits) missingFields.push("CNP");
  else if (!cnpIsValid) missingFields.push("CNP (invalid)");

  if (isEmptySpreadsheetValue(raw.address)) missingFields.push("Adresa");
  const salaryAmount = raw.salaryAmount;
  if (
    salaryAmount == null ||
    salaryAmount === "" ||
    (typeof salaryAmount === "number" && !Number.isFinite(salaryAmount))
  ) {
    missingFields.push("Salariu");
  }

  const cnpForStorage = cnpIsValid
    ? cnpDigits
    : generateImportPlaceholderCnp(organizationId, rowIndex);

  if (!lastName) lastName = firstName || "Necunoscut";
  if (!firstName) firstName = "";

  const importStatus = missingFields.length === 0 ? "complet" : "incomplet";
  const observations = appendImportMetadataToObservations(
    raw.observations as string | null | undefined,
    importStatus,
    missingFields,
  );

  return {
    ...raw,
    firstName,
    lastName,
    cnp: cnpDigits,
    cnpForStorage,
    cnpIsValid,
    importStatus,
    missingFields,
    observations,
  };
}

export function isPlaceholderImportCnp(cnp: string): boolean {
  return cnp.startsWith("9") && cnp.length === 13 && !validateCNP(cnp);
}

/** Prefix in observations for rows saved with generated CNP. */
export function placeholderCnpObservationNote(realCnp: string): string {
  return `${PLACEHOLDER_MARK}: CNP provizoriu ${realCnp} — de inlocuit`;
}
