import "server-only";

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { jsPDF } from "jspdf";
import type { Prisma } from "@prisma/client";
import { prismaTyped as prisma } from "@/lib/prisma";
import { sanitizeFilename } from "@/lib/documentConstants";
import {
  buildFluturasJsPdfDocument,
  type FluturasPdfData,
} from "@/lib/pdf/fluturasPdf";

function toMoney(n: unknown): number {
  const v = typeof n === "object" && n !== null && "toString" in n ? Number(String(n)) : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function week2(week: number): string {
  return String(week).padStart(2, "0");
}

function buildRelativePdfPath(year: number, weekNumber: number, fileName: string): string {
  return `data/payslips/${year}/${week2(weekNumber)}/${fileName}`;
}

function resolveFsPathFromRelative(relative: string): string {
  return join(process.cwd(), ...relative.split("/"));
}

const payslipPdfInclude = {
  employee: { select: { id: true, firstName: true, lastName: true, position: true } as const },
  company: { select: { id: true, name: true, address: true } as const },
  timesheet: { select: { id: true, hoursWorked: true } as const },
  items: { orderBy: { sortOrder: "asc" as const } },
} as const;

/** Shape returned by findUnique + payslipPdfInclude */
export type PayslipForPdf = Prisma.PayslipGetPayload<{ include: typeof payslipPdfInclude }>;

export function payslipToFluturasPdfData(payslip: PayslipForPdf): FluturasPdfData {
  const currency = (payslip.currency || "EUR").toUpperCase();
  const netSalaryItem = payslip.items.find((i) => i.type === "NET_SALARY");
  const holidayMoneyItem = payslip.items.find((i) => i.type === "HOLIDAY_MONEY");
  const travelAllowanceItem = payslip.items.find((i) => i.type === "TRAVEL_ALLOWANCE");

  const empName = `${String(payslip.employee.lastName ?? "").trim()} ${String(
    payslip.employee.firstName ?? ""
  ).trim()}`.trim();

  return {
    angajatNume: empName || "—",
    angajatId: String(payslip.employeeId),
    pozitie: String(payslip.employee.position ?? "—"),
    saptamana: payslip.weekNumber,
    an: payslip.year,
    perioadaStart: new Date(payslip.periodStart).toLocaleDateString("ro-RO"),
    perioadaEnd: new Date(payslip.periodEnd).toLocaleDateString("ro-RO"),
    oreLucrate: Number(payslip.timesheet.hoursWorked ?? 0),
    salariuNet: toMoney(netSalaryItem?.amount ?? 0),
    diurna: toMoney(travelAllowanceItem?.amount ?? 0),
    totalPlatit: toMoney(payslip.totalPaid),
    holidayMoney: toMoney(holidayMoneyItem?.amount ?? 0),
    moneda: currency,
    numeFirma: payslip.company.name ?? undefined,
    adresaFirma: payslip.company.address ?? undefined,
  };
}

/**
 * Construiește PDF-ul fluturașului (doar date salariale / firmă — fără subiect sau mesaj de email).
 */
export function buildPayslipPdfDocument(payslip: PayslipForPdf): jsPDF {
  return buildFluturasJsPdfDocument(payslipToFluturasPdfData(payslip));
}

export type GeneratedPayslipPdf = {
  pdfBytes: Uint8Array;
  relativePath: string;
  fileName: string;
};

/**
 * Buffer PDF pentru atașament la email: **același conținut** ca fluturașul standard (fără text personalizat).
 */
export async function buildPayslipPdfBufferForEmail(
  payslipId: number
): Promise<{ buffer: Buffer; fileName: string }> {
  const payslip = await prisma.payslip.findUnique({
    where: { id: payslipId },
    include: payslipPdfInclude,
  });

  if (!payslip) {
    throw new Error("Payslip not found");
  }

  if (payslip.pdfPath) {
    try {
      const buf = await readFile(resolveFsPathFromRelative(payslip.pdfPath));
      const empName = `${String(payslip.employee.lastName ?? "").trim()} ${String(
        payslip.employee.firstName ?? ""
      ).trim()}`.trim();
      const safeName =
        sanitizeFilename(empName || `employee_${payslip.employeeId}`) || `employee_${payslip.employeeId}`;
      return { buffer: Buffer.from(buf), fileName: `${safeName}.pdf` };
    } catch {
      // generează mai jos
    }
  }

  const generated = await generatePayslipPdf(payslipId);
  return { buffer: Buffer.from(generated.pdfBytes), fileName: generated.fileName };
}

/**
 * Generează PDF-ul unui fluturaș, îl salvează pe disc și actualizează `pdfPath` + `pdfGeneratedAt`.
 * Dacă `pdfPath` există și fișierul e prezent, returnează fișierul existent.
 */
export async function generatePayslipPdf(payslipId: number): Promise<GeneratedPayslipPdf> {
  const payslip = await prisma.payslip.findUnique({
    where: { id: payslipId },
    include: payslipPdfInclude,
  });

  if (!payslip) {
    throw new Error("Payslip not found");
  }

  if (payslip.pdfPath) {
    try {
      const buf = await readFile(resolveFsPathFromRelative(payslip.pdfPath));
      return {
        pdfBytes: new Uint8Array(buf),
        relativePath: payslip.pdfPath,
        fileName: `payslip-${payslip.id}.pdf`,
      };
    } catch {
      // fallthrough
    }
  }

  const empName = `${String(payslip.employee.lastName ?? "").trim()} ${String(
    payslip.employee.firstName ?? ""
  ).trim()}`.trim();
  const safeName =
    sanitizeFilename(empName || `employee_${payslip.employeeId}`) || `employee_${payslip.employeeId}`;
  const fileName = `${safeName}.pdf`;

  const relativePath = buildRelativePdfPath(payslip.year, payslip.weekNumber, fileName);
  const fsPath = resolveFsPathFromRelative(relativePath);

  await mkdir(join(process.cwd(), "data", "payslips", String(payslip.year), week2(payslip.weekNumber)), {
    recursive: true,
  });

  const doc = buildPayslipPdfDocument(payslip);
  const pdfBytes = new Uint8Array(doc.output("arraybuffer"));
  await writeFile(fsPath, Buffer.from(pdfBytes));

  await prisma.payslip.update({
    where: { id: payslip.id },
    data: { pdfPath: relativePath, pdfGeneratedAt: new Date() },
    select: { id: true },
  });

  return { pdfBytes, relativePath, fileName };
}
