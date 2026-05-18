import * as XLSX from "xlsx";

export type ParsedEmployeeSpreadsheetRow = {
  rowIndex: number;
  lastName: string;
  firstName: string;
  cnp: string;
  position?: string;
  salary?: string;
  email?: string;
  phone?: string;
  iban?: string;
  bankName?: string;
  address?: string;
  city?: string;
};

export type ParseEmployeeSpreadsheetResult = {
  employees: ParsedEmployeeSpreadsheetRow[];
  warnings: string[];
};

type FieldKey = keyof Omit<ParsedEmployeeSpreadsheetRow, "rowIndex">;

const HEADER_ALIASES: Record<string, FieldKey> = {
  nume: "lastName",
  name: "lastName",
  lastname: "lastName",
  prenume: "firstName",
  firstname: "firstName",
  cnp: "cnp",
  functie: "position",
  functia: "position",
  position: "position",
  rol: "position",
  job: "position",
  salariu: "salary",
  salary: "salary",
  sumabruta: "salary",
  suma: "salary",
  email: "email",
  telefon: "phone",
  phone: "phone",
  iban: "iban",
  banca: "bankName",
  bank: "bankName",
  bankname: "bankName",
  adresa: "address",
  address: "address",
  oras: "city",
  city: "city",
};

const RO_T = "\u021B\u0163";
const RO_S = "\u0219\u015F";

function normalizeHeader(value: unknown): string {
  let s = String(value ?? "")
    .trim()
    .toLowerCase();
  for (const ch of RO_T) s = s.split(ch).join("t");
  for (const ch of RO_S) s = s.split(ch).join("s");
  s = s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\u0103/g, "a")
    .replace(/\u00E2/g, "a")
    .replace(/\u00EE/g, "i")
    .replace(/[^a-z0-9]/g, "");
  return s;
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value) && Math.abs(value) >= 1e11) {
      return String(Math.trunc(value));
    }
    return String(value);
  }
  return String(value).trim();
}

function normalizeCnp(raw: string): string {
  return raw.replace(/\D/g, "");
}

function isRowEmpty(cells: unknown[]): boolean {
  return cells.every((c) => cellToString(c) === "");
}

function resolveFieldKey(header: string): FieldKey | null {
  const norm = normalizeHeader(header);
  if (!norm) return null;
  return HEADER_ALIASES[norm] ?? null;
}

function findHeaderRowIndex(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!row || isRowEmpty(row)) continue;
    const keys = row
      .map((cell) => resolveFieldKey(cellToString(cell)))
      .filter(Boolean);
    const hasCnp = keys.includes("cnp");
    const hasName = keys.includes("lastName") || keys.includes("firstName");
    if (hasCnp && hasName) return i;
  }
  return rows.length > 0 ? 0 : -1;
}

function sheetToRows(buffer: Buffer, fileName: string): unknown[][] {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const readOpts: XLSX.ParsingOptions =
    ext === "csv"
      ? { type: "buffer", raw: false, codepage: 65001 }
      : { type: "buffer", raw: false };

  const workbook = XLSX.read(buffer, readOpts);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];
}

/** Parse first sheet from Excel (.xlsx/.xls) or CSV. */
export function parseEmployeesFromSpreadsheet(
  buffer: Buffer,
  fileName: string,
): ParseEmployeeSpreadsheetResult {
  const warnings: string[] = [];
  let rows: unknown[][];

  try {
    rows = sheetToRows(buffer, fileName);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "read error";
    throw new Error(`Could not read file: ${msg}`);
  }

  if (rows.length === 0) {
    return {
      employees: [],
      warnings: ["File has no data rows."],
    };
  }

  const headerRowIndex = findHeaderRowIndex(rows);
  if (headerRowIndex < 0) {
    return {
      employees: [],
      warnings: [
        "No header row with Nume, Prenume and CNP columns was found.",
      ],
    };
  }

  const headerRow = rows[headerRowIndex] ?? [];
  const columnMap = new Map<number, FieldKey>();
  for (let col = 0; col < headerRow.length; col++) {
    const key = resolveFieldKey(cellToString(headerRow[col]));
    if (key) columnMap.set(col, key);
  }

  if (![...columnMap.values()].includes("cnp")) {
    return {
      employees: [],
      warnings: ["Missing CNP column in header."],
    };
  }

  const employees: ParsedEmployeeSpreadsheetRow[] = [];
  const dash = "\u2014";

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || isRowEmpty(row)) continue;

    const draft: Partial<ParsedEmployeeSpreadsheetRow> = { rowIndex: r + 1 };
    for (const [col, field] of columnMap.entries()) {
      const raw = cellToString(row[col]);
      if (!raw) continue;
      if (field === "cnp") {
        draft.cnp = normalizeCnp(raw);
      } else {
        draft[field] = raw;
      }
    }

    const lastName = (draft.lastName ?? "").trim();
    const firstName = (draft.firstName ?? "").trim();
    const cnp = (draft.cnp ?? "").trim();

    if (!lastName && !firstName && !cnp) continue;

    if (!cnp) {
      warnings.push(`Row ${r + 1}: missing CNP, skipped.`);
      continue;
    }

    employees.push({
      rowIndex: r + 1,
      lastName: lastName || dash,
      firstName: firstName || dash,
      cnp,
      position: draft.position?.trim() || undefined,
      salary: draft.salary?.trim() || undefined,
      email: draft.email?.trim() || undefined,
      phone: draft.phone?.trim() || undefined,
      iban: draft.iban?.trim() || undefined,
      bankName: draft.bankName?.trim() || undefined,
      address: draft.address?.trim() || undefined,
      city: draft.city?.trim() || undefined,
    });
  }

  if (employees.length === 0 && warnings.length === 0) {
    warnings.push(
      "No employee rows found after header. Check column names: Nume, Prenume, CNP.",
    );
  }

  return { employees, warnings };
}

export const SPREADSHEET_IMPORT_EXTENSIONS = [".xlsx", ".xls", ".csv"] as const;

export function isSpreadsheetImportFileName(fileName: string): boolean {
  const dot = fileName.lastIndexOf(".");
  const ext = dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
  return (SPREADSHEET_IMPORT_EXTENSIONS as readonly string[]).includes(ext);
}
