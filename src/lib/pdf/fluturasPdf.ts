import "server-only";

import {
  addSettingsLogo,
  registerPdfFontWithFallback,
} from "@/lib/pdf/jsPdfBranding";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const MARGIN = 40;

/** Payslip PDF fields only (no email subject/body). */
export type FluturasPdfData = {
  angajatNume: string;
  angajatId: string;
  pozitie: string;
  saptamana: number;
  an: number;
  perioadaStart: string;
  perioadaEnd: string;
  oreLucrate: number;
  salariuNet: number;
  diurna: number;
  totalPlatit: number;
  holidayMoney: number;
  moneda: string;
  numeFirma?: string;
  adresaFirma?: string;
};

function formatMoney(amount: number, currency: string): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `${n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/**
 * Payslip PDF: company header, employee, amounts, holiday money (no email subject/message).
 */
export function buildFluturasJsPdfDocument(data: FluturasPdfData): jsPDF {
  const moneda =
    String(data.moneda ?? "EUR")
      .trim()
      .toUpperCase() || "EUR";
  const numeFirma =
    String(data.numeFirma ?? "Cedol Autocraft SRL").trim() ||
    "Cedol Autocraft SRL";
  const adresaFirma =
    String(
      data.adresaFirma ?? "Iasi, Str. Pacurari nr. 159a, Jud. Iasi",
    ).trim() || "Iasi, Str. Pacurari nr. 159a, Jud. Iasi";

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pdfFont = registerPdfFontWithFallback(doc);
  const pageW = doc.internal.pageSize.getWidth();

  let y = 14;
  const textX = addSettingsLogo(doc, MARGIN, y, 48, 36);

  doc.setFont(pdfFont, "bold");
  doc.setFontSize(16);
  doc.setTextColor(13, 110, 253);
  doc.text(numeFirma, textX, y + 14);
  doc.setFont(pdfFont, "normal");
  doc.setFontSize(10);
  doc.setTextColor(102, 102, 102);
  doc.text(adresaFirma, textX, y + 30);

  doc.setDrawColor(13, 110, 253);
  doc.setLineWidth(1.5);
  const headerBottom = y + 48;
  doc.line(MARGIN, headerBottom, pageW - MARGIN, headerBottom);

  y = headerBottom + 24;
  doc.setTextColor(0, 0, 0);

  const empName = String(data.angajatNume ?? "").trim() || "-";
  doc.setFont(pdfFont, "normal");
  doc.setFontSize(10);
  doc.setTextColor(102, 102, 102);
  doc.text("Employee", MARGIN, y);
  doc.setFont(pdfFont, "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(empName, pageW - MARGIN, y, { align: "right" });

  y += 22;
  doc.setFont(pdfFont, "normal");
  doc.setFontSize(10);
  doc.setTextColor(102, 102, 102);
  doc.text("Employee ID", MARGIN, y);
  doc.setFont(pdfFont, "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(String(data.angajatId ?? ""), MARGIN + 88, y);
  doc.setFont(pdfFont, "normal");
  doc.setTextColor(102, 102, 102);
  doc.text(`Week: ${data.saptamana} | Year: ${data.an}`, pageW - MARGIN, y, {
    align: "right",
  });

  y += 18;
  doc.text("Position", MARGIN, y);
  doc.setFont(pdfFont, "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(String(data.pozitie ?? "-"), MARGIN + 88, y);
  doc.setFont(pdfFont, "normal");
  doc.setTextColor(102, 102, 102);
  doc.text(`${data.perioadaStart} - ${data.perioadaEnd}`, pageW - MARGIN, y, {
    align: "right",
  });

  y += 28;
  doc.setFont(pdfFont, "bold");
  doc.setFontSize(12);
  doc.setTextColor(13, 110, 253);
  doc.text(moneda, pageW - MARGIN, y, { align: "right" });
  y += 8;

  const ore = Number.isFinite(Number(data.oreLucrate))
    ? Number(data.oreLucrate)
    : 0;
  const rows = [
    ["Hours worked", ore.toFixed(2)],
    ["Net Salary", formatMoney(data.salariuNet, moneda)],
    ["Travel allowance", formatMoney(data.diurna, moneda)],
    ["Total paid", formatMoney(data.totalPlatit, moneda)],
  ];

  autoTable(doc, {
    startY: y,
    body: rows,
    theme: "plain",
    styles: {
      font: pdfFont,
      fontSize: 10,
      cellPadding: { top: 6, bottom: 6, left: 0, right: 0 },
      textColor: [51, 51, 51],
    },
    columnStyles: {
      0: { cellWidth: "auto", textColor: [102, 102, 102] },
      1: { halign: "right", fontStyle: "bold", textColor: [25, 25, 25] },
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.row.index === 3) {
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.fontSize = 12;
        hookData.cell.styles.textColor = [13, 110, 253];
      }
    },
    margin: { left: MARGIN, right: MARGIN },
    tableLineColor: [238, 238, 238],
    tableLineWidth: 0.5,
  });

  const afterTableY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? y + 80;
  let hy = afterTableY + 16;

  doc.setFillColor(248, 249, 250);
  doc.roundedRect(MARGIN, hy, pageW - 2 * MARGIN, 38, 4, 4, "F");
  doc.setFont(pdfFont, "normal");
  doc.setFontSize(10);
  doc.setTextColor(102, 102, 102);
  doc.text("Holiday money earned:", MARGIN + 10, hy + 24);
  doc.setFont(pdfFont, "bold");
  doc.setTextColor(40, 167, 69);
  doc.text(
    formatMoney(data.holidayMoney, moneda),
    pageW - MARGIN - 10,
    hy + 24,
    { align: "right" },
  );

  hy += 52;
  doc.setFont(pdfFont, "italic");
  doc.setFontSize(9);
  doc.setTextColor(220, 53, 69);
  const notice =
    "These are your net earnings for this week. Gross income, contributions and taxes " +
    "are available only at month level in the monthly payslips.";
  doc.text(notice, MARGIN, hy, { maxWidth: pageW - 2 * MARGIN, align: "left" });

  return doc;
}

/** Same visual output as buildFluturasJsPdfDocument; returns a Buffer for attachments/APIs. */
export function generateFluturasPdf(data: FluturasPdfData): Buffer {
  const doc = buildFluturasJsPdfDocument(data);
  return Buffer.from(doc.output("arraybuffer"));
}
