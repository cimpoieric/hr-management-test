import "server-only";

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { prismaTyped as prisma } from "@/lib/prisma";
import { sanitizeFilename } from "@/lib/documentConstants";
import { addSettingsLogo, registerPdfFontWithFallback } from "@/lib/pdf/jsPdfBranding";

function toMoney(n: unknown): number {
  const v = typeof n === "object" && n !== null && "toString" in n ? Number(String(n)) : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function formatMoney(amount: unknown, currency: string): string {
  const n = toMoney(amount);
  return `${n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
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

export type GeneratedPayslipPdf = {
  pdfBytes: Uint8Array;
  relativePath: string;
  fileName: string;
};

/**
 * Generează PDF-ul unui fluturaș, îl salvează pe disc și actualizează `pdfPath` + `pdfGeneratedAt`.
 * Dacă `pdfPath` există și fișierul e prezent, returnează fișierul existent.
 */
export async function generatePayslipPdf(payslipId: number): Promise<GeneratedPayslipPdf> {
  const payslip = await prisma.payslip.findUnique({
    where: { id: payslipId },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, position: true } },
      company: { select: { id: true, name: true, address: true } },
      timesheet: { select: { id: true, hoursWorked: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!payslip) {
    throw new Error("Payslip not found");
  }

  const currency = (payslip.currency || "EUR").toUpperCase();

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

  const netSalaryItem = payslip.items.find((i) => i.type === "NET_SALARY");
  const holidayMoneyItem = payslip.items.find((i) => i.type === "HOLIDAY_MONEY");
  const travelAllowanceItem = payslip.items.find((i) => i.type === "TRAVEL_ALLOWANCE");

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pdfFont = registerPdfFontWithFallback(doc);
  const marginLeft = 40;
  const topY = 14;
  const textX = addSettingsLogo(doc, marginLeft, topY, 48, 36);

  doc.setFont(pdfFont, "bold");
  doc.setFontSize(12);
  doc.text(String(payslip.company.name ?? "Company"), textX, 28);
  doc.setFont(pdfFont, "normal");
  doc.setFontSize(9);
  if (payslip.company.address) {
    doc.text(String(payslip.company.address), textX, 42);
  }

  doc.setFont(pdfFont, "bold");
  doc.setFontSize(13);
  doc.text("Cedol Autocraft", marginLeft, 70);
  doc.setFont(pdfFont, "normal");
  doc.setFontSize(10);
  const periodLine = `Week ${payslip.weekNumber}, Year ${payslip.year}, Perioada ${new Date(
    payslip.periodStart
  ).toLocaleDateString("ro-RO")} - ${new Date(payslip.periodEnd).toLocaleDateString("ro-RO")}`;
  doc.text(periodLine, marginLeft, 88);

  doc.setFontSize(10);
  doc.text(`Employee: ${empName || "—"}`, marginLeft, 112);
  doc.text(
    `Employee ID: ${payslip.employeeId}   Position: ${payslip.employee.position ?? "—"}`,
    marginLeft,
    128
  );

  const rows = [
    ["Hours worked", String(payslip.timesheet.hoursWorked)],
    ["Net Salary", formatMoney(netSalaryItem?.amount ?? 0, currency)],
    ["Travel allowance", formatMoney(travelAllowanceItem?.amount ?? 0, currency)],
    ["Total paid", formatMoney(payslip.totalPaid, currency)],
  ];

  autoTable(doc, {
    startY: 150,
    head: [["Item", "Value"]],
    body: rows,
    styles: { font: pdfFont, fontStyle: "normal", fontSize: 10, cellPadding: 6 },
    headStyles: { font: pdfFont, fontStyle: "bold", fillColor: [235, 240, 248], textColor: [25, 25, 25] },
    margin: { left: marginLeft, right: marginLeft },
  });

  const afterTableY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 250;

  doc.setFont(pdfFont, "italic");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text("These are your net earnings for this week.", marginLeft, afterTableY + 28);
  doc.setFont(pdfFont, "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Holiday money: ${formatMoney(holidayMoneyItem?.amount ?? 0, currency)}`, marginLeft, afterTableY + 46);

  const pdfBytes = new Uint8Array(doc.output("arraybuffer"));
  await writeFile(fsPath, Buffer.from(pdfBytes));

  await prisma.payslip.update({
    where: { id: payslip.id },
    data: { pdfPath: relativePath, pdfGeneratedAt: new Date() },
    select: { id: true },
  });

  return { pdfBytes, relativePath, fileName };
}

