import type { SpreadsheetEmployeeImportItem } from "@/lib/parsers/employeeSpreadsheetMap";
import { parseSalaryTypeInput } from "@/lib/salaryFields";
import { Prisma } from "@prisma/client";

function parseIsoDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseImportDateOnly(
  value: string | null | undefined,
): Date | undefined {
  const iso = parseIsoDate(value);
  if (!iso) return undefined;
  return new Date(
    Date.UTC(iso.getUTCFullYear(), iso.getUTCMonth(), iso.getUTCDate()),
  );
}

/** DB fields for employee create/update from spreadsheet import row. */
export function spreadsheetImportItemToEmployeeData(
  item: SpreadsheetEmployeeImportItem,
): {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  bankName: string | null;
  address: string | null;
  city: string | null;
  position: string | null;
  observations: string | null;
  workNorm: string | null;
  seriesCI: string | null;
  numberCI: string | null;
  status: string;
  hiredAt?: Date;
  salaryType: ReturnType<typeof parseSalaryTypeInput>;
  salaryAmount: Prisma.Decimal | null;
  salaryCurrency: string;
  salaryStartDate: Date | null;
  paymentFrequency: string;
  statusImport: string;
  campuriLipsa: Prisma.InputJsonValue | null;
  sursaFoaie: string | null;
  nrCrtExcel: number | null;
  bsn: string | null;
  postedW: string | null;
  a1: string | null;
  decizie: string | null;
  fisaAppPsi: string | null;
  dataAngajareOriginala: Date | null;
  dataIncetareOriginala: string | null;
} {
  const salaryType = item.salaryType
    ? parseSalaryTypeInput(item.salaryType)
    : null;
  const salaryAmount =
    item.salaryAmount != null && Number.isFinite(item.salaryAmount)
      ? new Prisma.Decimal(item.salaryAmount)
      : null;

  const missing = item.missingFields ?? [];
  const statusImport = item.importStatus ?? (missing.length === 0 ? "complet" : "incomplet");

  return {
    firstName: item.firstName,
    lastName: item.lastName,
    email: item.email ?? null,
    phone: item.phone ?? null,
    bankName: item.bankName ?? null,
    address: item.address ?? null,
    city: item.city ?? null,
    position: item.position ?? null,
    observations: item.observations ?? null,
    workNorm: item.workNorm ?? null,
    seriesCI: item.seriesCI ?? null,
    numberCI: item.numberCI ?? null,
    status: item.status ?? "ACTIVE",
    hiredAt: parseIsoDate(item.hiredAt ?? undefined),
    salaryType,
    salaryAmount,
    salaryCurrency: item.salaryCurrency ?? "RON",
    salaryStartDate: parseIsoDate(item.salaryStartDate ?? undefined) ?? null,
    paymentFrequency: item.paymentFrequency ?? "weekly",
    statusImport,
    campuriLipsa: missing.length > 0 ? (missing as Prisma.InputJsonValue) : null,
    sursaFoaie: item.sourceSheet ?? null,
    nrCrtExcel: item.nrCrtExcel ?? null,
    bsn: item.bsn ?? null,
    postedW: item.postedW ?? null,
    a1: item.a1 ?? null,
    decizie: item.decizie ?? null,
    fisaAppPsi: item.fisaAppPsi ?? null,
    dataAngajareOriginala:
      parseImportDateOnly(item.dataAngajareOriginala ?? item.hiredAt) ?? null,
    dataIncetareOriginala: item.dataIncetareOriginala ?? null,
  };
}
