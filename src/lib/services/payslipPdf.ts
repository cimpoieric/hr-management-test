import "server-only";

import { join } from "path";
import { getAppSettings } from "@/lib/appSettings";
import { sanitizeFilename } from "@/lib/documentConstants";
import {
  mapPayslipApiResponseToPayslipData,
  weeklyPayslipPdfBytes,
} from "@/lib/pdf/weeklyPayslipPdf";
import { clampCalendarMonth } from "@/lib/paymentPeriod";
import { prismaTyped as prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { mkdir, readFile, writeFile } from "fs/promises";

const payslipPdfInclude = {
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      position: true,
    } as const,
  },
  company: { select: { id: true, name: true, address: true } as const },
  timesheet: { select: { id: true, hoursWorked: true } as const },
  items: { orderBy: { sortOrder: "asc" as const } },
} as const;

export type PayslipForPdf = Prisma.PayslipGetPayload<{
  include: typeof payslipPdfInclude;
}> & {
  type?: string | null;
  month?: number | null;
  monthYear?: number | null;
};

export type GeneratedPayslipPdf = {
  pdfBytes: Uint8Array;
  relativePath: string;
  fileName: string;
};

function isMonthlyPayslip(p: {
  type?: string | null;
  month?: number | null;
  weekNumber?: number;
}): boolean {
  if (p.type === "monthly") return true;
  return p.month != null && p.month > 0;
}

/** Folder segment under data/payslips/{yearDir}/{periodDir}/ */
function buildPayslipStorageDirs(payslip: {
  type?: string | null;
  year: number;
  weekNumber: number;
  month?: number | null;
  monthYear?: number | null;
}): { yearDir: string; periodDir: string } {
  if (isMonthlyPayslip(payslip)) {
    const y = payslip.monthYear ?? payslip.year;
    const m = clampCalendarMonth(payslip.month ?? 1);
    return {
      yearDir: String(y),
      periodDir: `M${String(m).padStart(2, "0")}`,
    };
  }
  const w = Math.min(53, Math.max(1, payslip.weekNumber || 1));
  return {
    yearDir: String(payslip.year),
    periodDir: `W${String(w).padStart(2, "0")}`,
  };
}

function buildRelativePdfPath(
  payslip: {
    type?: string | null;
    year: number;
    weekNumber: number;
    month?: number | null;
    monthYear?: number | null;
  },
  fileName: string,
): string {
  const { yearDir, periodDir } = buildPayslipStorageDirs(payslip);
  return `data/payslips/${yearDir}/${periodDir}/${fileName}`;
}

function resolveFsPathFromRelative(relative: string): string {
  return join(process.cwd(), ...relative.split("/"));
}

function payslipEmployeeFileName(payslip: PayslipForPdf): string {
  const empName = `${String(payslip.employee.lastName ?? "").trim()} ${String(
    payslip.employee.firstName ?? "",
  ).trim()}`.trim();
  const safeName =
    sanitizeFilename(empName || `employee_${payslip.employeeId}`) ||
    `employee_${payslip.employeeId}`;
  return `${safeName}.pdf`;
}

function canPersistPayslipPdfToDisk(): boolean {
  return process.env.VERCEL !== "1";
}

async function renderPayslipPdfBytes(
  payslip: PayslipForPdf,
): Promise<Uint8Array> {
  const settings = await getAppSettings(payslip.organizationId);
  return weeklyPayslipPdfBytes(
    mapPayslipApiResponseToPayslipData(
      {
        type: payslip.type,
        employeeId: payslip.employeeId,
        weekNumber: payslip.weekNumber,
        year: payslip.year,
        month: payslip.month,
        monthYear: payslip.monthYear,
        periodStart: payslip.periodStart,
        periodEnd: payslip.periodEnd,
        netTotal: payslip.netTotal,
        totalPaid: payslip.totalPaid,
        employee: payslip.employee,
        company: payslip.company,
        timesheet: payslip.timesheet,
        items: payslip.items,
      },
      {
        companyName: settings.companyName,
        companyAddress: settings.companyAddress,
      },
    ),
  );
}

/** Email attachments: always in-memory (Vercel has no writable data/). */
export async function buildPayslipPdfBufferForEmail(
  payslipId: number,
): Promise<{ buffer: Buffer; fileName: string }> {
  const payslip = await prisma.payslip.findUnique({
    where: { id: payslipId },
    include: payslipPdfInclude,
  });

  if (!payslip) {
    throw new Error("Payslip not found");
  }

  if (canPersistPayslipPdfToDisk() && payslip.pdfPath) {
    try {
      const buf = await readFile(resolveFsPathFromRelative(payslip.pdfPath));
      return { buffer: Buffer.from(buf), fileName: payslipEmployeeFileName(payslip) };
    } catch {
      // generate in memory below
    }
  }

  const pdfBytes = await renderPayslipPdfBytes(payslip);
  return {
    buffer: Buffer.from(pdfBytes),
    fileName: payslipEmployeeFileName(payslip),
  };
}

export async function generatePayslipPdf(
  payslipId: number,
): Promise<GeneratedPayslipPdf> {
  const payslip = await prisma.payslip.findUnique({
    where: { id: payslipId },
    include: payslipPdfInclude,
  });

  if (!payslip) {
    throw new Error("Payslip not found");
  }

  const fileName = payslipEmployeeFileName(payslip);

  if (canPersistPayslipPdfToDisk() && payslip.pdfPath) {
    try {
      const buf = await readFile(resolveFsPathFromRelative(payslip.pdfPath));
      return {
        pdfBytes: new Uint8Array(buf),
        relativePath: payslip.pdfPath,
        fileName,
      };
    } catch {
      // fallthrough
    }
  }

  const pdfBytes = await renderPayslipPdfBytes(payslip);
  const relativePath = buildRelativePdfPath(payslip, fileName);

  if (canPersistPayslipPdfToDisk()) {
    const { yearDir, periodDir } = buildPayslipStorageDirs(payslip);
    const fsPath = resolveFsPathFromRelative(relativePath);
    await mkdir(
      join(process.cwd(), "data", "payslips", yearDir, periodDir),
      { recursive: true },
    );
    await writeFile(fsPath, Buffer.from(pdfBytes));

    await prisma.payslip.update({
      where: { id: payslip.id },
      data: { pdfPath: relativePath, pdfGeneratedAt: new Date() },
      select: { id: true },
    });
  }

  return { pdfBytes, relativePath, fileName };
}
