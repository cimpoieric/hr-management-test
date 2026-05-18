import * as XLSX from "xlsx";

export type ParsedEmployeeSpreadsheetRow = {
  rowIndex: number;
  lastName: string;
  firstName: string;
  cnp: string;
  /** Excel sheet name (company / deployment source). */
  sourceSheet?: string;
  position?: string;
  salary?: string;
  email?: string;
  phone?: string;
  iban?: string;
  bankName?: string;
  address?: string;
  city?: string;
  hiredAt?: string;
  terminationDate?: string;
  workNorm?: string;
  bsn?: string;
  a1?: string;
  contract?: string;
  decision?: string;
  ciDocument?: string;
  fisaAppPsi?: string;
  rowNumber?: string;
};

export type ParseEmployeeSpreadsheetResult = {
  employees: ParsedEmployeeSpreadsheetRow[];
  warnings: string[];
  sheetsParsed?: number;
  sheetCount?: number;
};

type FieldKey = keyof Omit<
  ParsedEmployeeSpreadsheetRow,
  "rowIndex" | "sourceSheet"
>;

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
  salarnegociat: "salary",
  dataang: "hiredAt",
  dataangajare: "hiredAt",
  datainc: "terminationDate",
  dataincetare: "terminationDate",
  bsn: "bsn",
  postedw: "workNorm",
  a1: "a1",
  cont: "contract",
  contract: "contract",
  decizie: "decision",
  ci: "ciDocument",
  fisaapppsi: "fisaAppPsi",
  nrcrt: "rowNumber",
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

/** Excel serial or ISO / RO date string ? YYYY-MM-DD. */
export function parseExcelDate(val: unknown): string | null {
  if (val == null || val === "") return null;

  if (typeof val === "string") {
    const t = val.trim();
    if (!t) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const ro = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (ro) {
      const dd = ro[1]!.padStart(2, "0");
      const mm = ro[2]!.padStart(2, "0");
      return `${ro[3]}-${mm}-${dd}`;
    }
    const parsed = new Date(t);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return null;
  }

  if (typeof val === "number" && Number.isFinite(val)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(epoch.getTime() + val * 86_400_000);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }

  return null;
}

/** Split full name from a single NUME column: first token = last name, rest = first name. */
export function parseNumeComplet(numeComplet: string): {
  nume: string;
  prenume: string;
} {
  if (!numeComplet) return { nume: "", prenume: "" };

  const parts = numeComplet.trim().split(/\s+/);

  if (parts.length === 1) {
    return { nume: parts[0] ?? "", prenume: "" };
  }

  const nume = parts[0] ?? "";
  const prenume = parts.slice(1).join(" ");
  return { nume, prenume };
}

function isRowEmpty(cells: unknown[]): boolean {
  return cells.every((c) => cellToString(c) === "");
}

function resolveFieldKey(header: string): FieldKey | null {
  const norm = normalizeHeader(header);
  if (!norm) return null;
  return HEADER_ALIASES[norm] ?? null;
}

const DATE_FIELDS = new Set<FieldKey>(["hiredAt", "terminationDate"]);

function assignDraftField(
  draft: Partial<ParsedEmployeeSpreadsheetRow>,
  field: FieldKey,
  rawCell: unknown,
): void {
  if (field === "cnp") {
    draft.cnp = normalizeCnp(cellToString(rawCell));
    return;
  }
  if (DATE_FIELDS.has(field)) {
    const iso = parseExcelDate(rawCell);
    draft[field] = iso ?? cellToString(rawCell);
    return;
  }
  draft[field] = cellToString(rawCell);
}

function looksLikeHeaderMarker(cell: unknown): boolean {
  const u = cellToString(cell).toUpperCase();
  return (
    u.includes("NUME") ||
    u.includes("NR.CRT") ||
    u.includes("NR CRT") ||
    u.includes("NRCRT")
  );
}

function findHeaderRowIndex(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!row || isRowEmpty(row)) continue;
    const keys = row
      .map((cell) => resolveFieldKey(cellToString(cell)))
      .filter(Boolean) as FieldKey[];
    const hasCnp = keys.includes("cnp");
    const hasName = keys.includes("lastName") || keys.includes("firstName");
    if (hasCnp && hasName) return i;
  }

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    if (!row || isRowEmpty(row)) continue;
    if (!row.some(looksLikeHeaderMarker)) continue;
    const keys = row
      .map((cell) => resolveFieldKey(cellToString(cell)))
      .filter(Boolean) as FieldKey[];
    const hasName = keys.includes("lastName") || keys.includes("firstName");
    const hasCnp = keys.includes("cnp");
    if (hasName && hasCnp) return i;
    if (hasName) return i;
  }

  return -1;
}

function readWorkbook(buffer: Buffer, fileName: string): XLSX.WorkBook {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const readOpts: XLSX.ParsingOptions =
    ext === "csv"
      ? { type: "buffer", raw: false, codepage: 65001 }
      : { type: "buffer", raw: false };

  return XLSX.read(buffer, readOpts);
}

function isMultiSheetExcel(fileName: string): boolean {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return ext === "xlsx" || ext === "xls";
}

function sheetToRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];
}

function parseRowsFromSheet(
  rows: unknown[][],
  sourceSheet: string,
  warnings: string[],
): ParsedEmployeeSpreadsheetRow[] {
  if (rows.length === 0) return [];

  const headerRowIndex = findHeaderRowIndex(rows);
  if (headerRowIndex < 0) return [];

  const headerRow = rows[headerRowIndex] ?? [];
  const columnMap = new Map<number, FieldKey>();
  for (let col = 0; col < headerRow.length; col++) {
    const key = resolveFieldKey(cellToString(headerRow[col]));
    if (key) columnMap.set(col, key);
  }

  if (![...columnMap.values()].includes("cnp")) {
    warnings.push(`Foaia "${sourceSheet}": lipseste coloana CNP, sarita.`);
    return [];
  }

  const employees: ParsedEmployeeSpreadsheetRow[] = [];
  const dash = "\u2014";
  const sheetLabel = sourceSheet || "Sheet";

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || isRowEmpty(row)) continue;

    const draft: Partial<ParsedEmployeeSpreadsheetRow> = { rowIndex: r + 1 };
    for (const [col, field] of columnMap.entries()) {
      const rawCell = row[col];
      const raw = cellToString(rawCell);
      if (!raw && !DATE_FIELDS.has(field)) continue;
      if (DATE_FIELDS.has(field) && rawCell == null) continue;
      assignDraftField(draft, field, rawCell);
    }

    let lastName = (draft.lastName ?? "").trim();
    let firstName = (draft.firstName ?? "").trim();

    if (lastName && !firstName) {
      const split = parseNumeComplet(lastName);
      lastName = split.nume;
      firstName = split.prenume;
    }

    const cnp = (draft.cnp ?? "").trim();

    if (!lastName && !firstName && !cnp) continue;

    if (!cnp) {
      warnings.push(
        `Foaia "${sheetLabel}", randul ${r + 1}: CNP lipsa  import incomplet.`,
      );
    }

    employees.push({
      rowIndex: r + 1,
      lastName: lastName || dash,
      firstName: firstName || dash,
      cnp: cnp || "",
      sourceSheet: sourceSheet || undefined,
      position: draft.position?.trim() || undefined,
      salary: draft.salary?.trim() || undefined,
      email: draft.email?.trim() || undefined,
      phone: draft.phone?.trim() || undefined,
      iban: draft.iban?.trim() || undefined,
      bankName: draft.bankName?.trim() || undefined,
      address: draft.address?.trim() || undefined,
      city: draft.city?.trim() || undefined,
      hiredAt: draft.hiredAt?.trim() || undefined,
      terminationDate: draft.terminationDate?.trim() || undefined,
      workNorm: draft.workNorm?.trim() || undefined,
      bsn: draft.bsn?.trim() || undefined,
      a1: draft.a1?.trim() || undefined,
      contract: draft.contract?.trim() || undefined,
      decision: draft.decision?.trim() || undefined,
      ciDocument: draft.ciDocument?.trim() || undefined,
      fisaAppPsi: draft.fisaAppPsi?.trim() || undefined,
      rowNumber: draft.rowNumber?.trim() || undefined,
    });
  }

  return employees;
}

/** Parse all sheets from Excel (.xlsx/.xls) or the single sheet from CSV. */
export function parseEmployeesFromSpreadsheet(
  buffer: Buffer,
  fileName: string,
): ParseEmployeeSpreadsheetResult {
  const warnings: string[] = [];
  let workbook: XLSX.WorkBook;

  try {
    workbook = readWorkbook(buffer, fileName);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "read error";
    throw new Error(`Could not read file: ${msg}`);
  }

  const sheetNames = workbook.SheetNames.filter(Boolean);
  if (sheetNames.length === 0) {
    return {
      employees: [],
      warnings: ["File has no worksheets."],
      sheetsParsed: 0,
      sheetCount: 0,
    };
  }

  const namesToParse: string[] = isMultiSheetExcel(fileName)
    ? sheetNames
    : sheetNames[0]
      ? [sheetNames[0]]
      : [];

  const employees: ParsedEmployeeSpreadsheetRow[] = [];
  let sheetsParsed = 0;

  for (const sheetName of namesToParse) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = sheetToRows(sheet);
    if (rows.length === 0 || rows.every((row) => !row || isRowEmpty(row))) {
      continue;
    }

    const label = sheetName.trim();
    const parsed = parseRowsFromSheet(rows, label, warnings);
    if (parsed.length > 0) {
      sheetsParsed++;
      employees.push(...parsed);
    }
  }

  if (namesToParse.length > 1) {
    warnings.unshift(
      `Citite ${sheetsParsed} foi cu angajati din ${namesToParse.length} foi totale (${employees.length} randuri).`,
    );
  }

  if (employees.length === 0 && warnings.length === 0) {
    warnings.push(
      "No employee rows found. Check column names: Nume (or Nume + Prenume), CNP.",
    );
  }

  return {
    employees,
    warnings,
    sheetsParsed,
    sheetCount: namesToParse.length,
  };
}

export const SPREADSHEET_IMPORT_EXTENSIONS = [".xlsx", ".xls", ".csv"] as const;

export function isSpreadsheetImportFileName(fileName: string): boolean {
  const dot = fileName.lastIndexOf(".");
  const ext = dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
  return (SPREADSHEET_IMPORT_EXTENSIONS as readonly string[]).includes(ext);
}
