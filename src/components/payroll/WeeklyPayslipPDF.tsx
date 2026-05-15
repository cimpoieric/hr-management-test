import { jsPDF } from "jspdf";

export type PayslipEmployerDetails = {
  companyName?: string | null;
  companyAddress?: string | null;
};

export interface PayslipData {
  payslipType?: "weekly" | "monthly";
  companyName: string;
  companyAddress: string;
  employeeName: string;
  employeeId: string;
  position: string;
  weekNumber: number;
  year: number;
  month?: number | null;
  monthYear?: number | null;
  periodStart: string;
  periodEnd: string;
  hoursWorked: number;
  hourlyRate: number;
  salaryForHours: number;
  netSalary: number;
  grossSalary?: number;
  casAmount?: number;
  cassAmount?: number;
  taxAmount?: number;
  travelAllowance: number;
  totalPaid: number;
  holidayMoney: number;
}

function formatDecimal(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatEuro(value: number): string {
  return `${formatDecimal(value)} \u20AC`;
}

function sanitizeFilePart(value: string): string {
  return value
    .trim()
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

const PAGE_MARGIN = 8;
const BORDER_X = PAGE_MARGIN;
const BORDER_Y = PAGE_MARGIN;
const BORDER_W = 210 - PAGE_MARGIN * 2;
const BORDER_H = 148 - PAGE_MARGIN * 2;
const HEADER_HEIGHT_MM = 16;
const LABEL_LEFT = 25;
const VALUE_LEFT = 85;
const LABEL_RIGHT = 110;
const VALUE_RIGHT = 175;
const WEEK_LABEL_X = 130;
const WEEK_VALUE_X = 170;
const RED_TEXT_X = 115;
const FOOTER_DIVIDER_X = 108;
const FOOTER_SEPARATOR_Y = 108;
const FOOTER_Y = 118;
const SEPARATOR_LINE_WIDTH = 0.53;
const BORDER_LINE_WIDTH = 0.53;
const LABEL_RGB: [number, number, number] = [100, 100, 100];
const VALUE_RGB: [number, number, number] = [0, 0, 0];
const HEADER_BG_RGB: [number, number, number] = [245, 245, 245];
const SEPARATOR_RGB: [number, number, number] = [0, 102, 204];
const FOOTER_RED_RGB: [number, number, number] = [200, 60, 60];

function setLabelStyle(doc: jsPDF, fontSize = 10): void {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...LABEL_RGB);
}

function setValueStyle(
  doc: jsPDF,
  fontSize = 11,
  bold = true,
): void {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...VALUE_RGB);
}

function drawLabelValueRow(
  doc: jsPDF,
  label: string,
  value: string,
  labelX: number,
  valueX: number,
  y: number,
  valueSize = 11,
  valueAlign: "left" | "right" = "left",
): void {
  setLabelStyle(doc);
  doc.text(label, labelX, y);
  setValueStyle(doc, valueSize);
  if (valueAlign === "right") {
    doc.text(value, valueX, y, { align: "right" });
    return;
  }
  doc.text(value, valueX, y);
}

function drawEurBadge(doc: jsPDF, x: number, y: number): void {
  const badgeW = 9;
  const badgeH = 4.2;
  doc.setFillColor(235, 245, 255);
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.2);
  doc.rect(x, y - 3.1, badgeW, badgeH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.text("EUR", x + badgeW / 2, y - 0.3, { align: "center" });
}

function drawBlueSeparator(
  doc: jsPDF,
  y: number,
  x1: number,
  x2: number,
): void {
  doc.setDrawColor(...SEPARATOR_RGB);
  doc.setLineWidth(SEPARATOR_LINE_WIDTH);
  doc.line(x1, y, x2, y);
}

export function buildMonthlyPayslipDocument(data: PayslipData): jsPDF {
  const doc = new jsPDF("l", "mm", "a5");
  const borderRight = BORDER_X + BORDER_W;
  const headerMidY = BORDER_Y + HEADER_HEIGHT_MM / 2;
  const headerCenterX = BORDER_X + BORDER_W / 2;

  doc.setFillColor(...HEADER_BG_RGB);
  doc.rect(BORDER_X, BORDER_Y, BORDER_W, HEADER_HEIGHT_MM, "F");

  setLabelStyle(doc);
  doc.text("Employer", BORDER_X + 6, headerMidY + 1);
  setValueStyle(doc, 18);
  doc.text(data.companyName, headerCenterX, headerMidY - 1, { align: "center" });
  setLabelStyle(doc);
  doc.text(data.companyAddress, headerCenterX, headerMidY + 4.5, {
    align: "center",
  });

  let y = BORDER_Y + HEADER_HEIGHT_MM + 6;
  const m = data.month ?? 1;
  const yLabel = data.monthYear ?? data.year;

  setLabelStyle(doc);
  doc.text("Name", LABEL_LEFT, y);
  setLabelStyle(doc);
  doc.text("Month :", WEEK_LABEL_X, y);
  setValueStyle(doc, 20);
  doc.text(String(m).padStart(2, "0"), WEEK_VALUE_X, y, { align: "right" });

  y += 7;
  setValueStyle(doc, 16);
  doc.text(data.employeeName, LABEL_LEFT, y);

  y += 10;
  drawLabelValueRow(doc, "Empl. ID", data.employeeId, LABEL_LEFT, VALUE_LEFT, y);
  setLabelStyle(doc);
  doc.text("Year :", WEEK_LABEL_X, y);
  setValueStyle(doc, 11);
  doc.text(String(yLabel), WEEK_VALUE_X, y, { align: "right" });

  y += 8;
  drawLabelValueRow(doc, "Position", data.position, LABEL_LEFT, VALUE_LEFT, y);
  setLabelStyle(doc);
  doc.text(`${data.periodStart}\u2014 ${data.periodEnd}`, WEEK_VALUE_X, y, {
    align: "right",
  });

  y += 10;
  drawBlueSeparator(doc, y, BORDER_X + 2, borderRight - 2);
  y += 8;

  const gross = data.grossSalary ?? data.salaryForHours;
  drawLabelValueRow(doc, "Gross salary", formatEuro(gross), LABEL_LEFT, VALUE_LEFT, y);
  drawLabelValueRow(
    doc,
    "CAS (25%)",
    formatEuro(data.casAmount ?? 0),
    LABEL_RIGHT,
    VALUE_RIGHT,
    y,
    11,
    "right",
  );

  y += 9;
  drawLabelValueRow(
    doc,
    "CASS (10%)",
    formatEuro(data.cassAmount ?? 0),
    LABEL_LEFT,
    VALUE_LEFT,
    y,
  );
  drawLabelValueRow(
    doc,
    "Income tax (10%)",
    formatEuro(data.taxAmount ?? 0),
    LABEL_RIGHT,
    VALUE_RIGHT,
    y,
    11,
    "right",
  );

  y += 9;
  drawLabelValueRow(
    doc,
    "Net salary",
    formatEuro(data.netSalary),
    LABEL_LEFT,
    VALUE_LEFT,
    y,
  );
  drawLabelValueRow(
    doc,
    "Travel allowance",
    formatEuro(data.travelAllowance),
    LABEL_RIGHT,
    VALUE_RIGHT,
    y,
    11,
    "right",
  );

  y += 7;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.15);
  doc.line(LABEL_RIGHT, y, VALUE_RIGHT, y);
  y += 7;
  setLabelStyle(doc);
  doc.text("Total paid", LABEL_RIGHT, y);
  setValueStyle(doc, 11);
  doc.text(formatEuro(data.totalPaid), VALUE_RIGHT, y, { align: "right" });

  drawBlueSeparator(doc, FOOTER_SEPARATOR_Y, BORDER_X + 2, borderRight - 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...FOOTER_RED_RGB);
  const footerLines = [
    "Monthly payslip with CAS 25%, CASS 10% and income tax 10%.",
    "Amounts are calculated from gross monthly salary in the employee profile.",
  ];
  footerLines.forEach((line, index) => {
    doc.text(line, RED_TEXT_X, FOOTER_Y + index * 3.2);
  });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(BORDER_LINE_WIDTH);
  doc.rect(BORDER_X, BORDER_Y, BORDER_W, BORDER_H, "S");

  return doc;
}

function buildPayslipDocument(data: PayslipData): jsPDF {
  return data.payslipType === "monthly"
    ? buildMonthlyPayslipDocument(data)
    : buildWeeklyPayslipDocument(data);
}

export function buildWeeklyPayslipDocument(data: PayslipData): jsPDF {
  const doc = new jsPDF("l", "mm", "a5");
  const borderRight = BORDER_X + BORDER_W;
  const borderBottom = BORDER_Y + BORDER_H;
  const headerCenterX = BORDER_X + BORDER_W / 2;
  const headerMidY = BORDER_Y + HEADER_HEIGHT_MM / 2;

  doc.setFillColor(...HEADER_BG_RGB);
  doc.rect(BORDER_X, BORDER_Y, BORDER_W, HEADER_HEIGHT_MM, "F");

  setLabelStyle(doc);
  doc.text("Employer", BORDER_X + 6, headerMidY + 1);
  setValueStyle(doc, 18);
  doc.text(data.companyName, headerCenterX, headerMidY - 1, { align: "center" });
  setLabelStyle(doc);
  doc.text(data.companyAddress, headerCenterX, headerMidY + 4.5, {
    align: "center",
  });

  let y = BORDER_Y + HEADER_HEIGHT_MM + 6;

  setLabelStyle(doc);
  doc.text("Name", LABEL_LEFT, y);
  setLabelStyle(doc);
  doc.text("Week :", WEEK_LABEL_X, y);
  setValueStyle(doc, 20);
  doc.text(String(data.weekNumber), WEEK_VALUE_X, y, { align: "right" });

  y += 7;
  setValueStyle(doc, 16);
  doc.text(data.employeeName, LABEL_LEFT, y);

  y += 10;
  drawLabelValueRow(
    doc,
    "Empl. ID",
    data.employeeId,
    LABEL_LEFT,
    VALUE_LEFT,
    y,
  );
  setLabelStyle(doc);
  doc.text("Year :", WEEK_LABEL_X, y);
  setValueStyle(doc, 11);
  doc.text(String(data.year), WEEK_VALUE_X, y, { align: "right" });

  y += 8;
  setLabelStyle(doc);
  doc.text("Position", LABEL_LEFT, y);
  setValueStyle(doc, 11);
  const positionLines = doc.splitTextToSize(
    data.position,
    WEEK_LABEL_X - VALUE_LEFT - 4,
  );
  doc.text(positionLines, VALUE_LEFT, y);
  setLabelStyle(doc);
  doc.text(`${data.periodStart}\u2014 ${data.periodEnd}`, WEEK_VALUE_X, y, {
    align: "right",
  });

  const separatorY =
    y + Math.max(6, (positionLines.length - 1) * 4 + 2);
  drawBlueSeparator(doc, separatorY, BORDER_X + 2, borderRight - 2);

  y = separatorY + 8;
  drawLabelValueRow(
    doc,
    "Hours worked this week:",
    formatDecimal(data.hoursWorked),
    LABEL_LEFT,
    VALUE_LEFT,
    y,
  );

  const netSalaryLabel = "Net Salary EUR";
  const netSalaryValue = formatEuro(data.netSalary);
  setLabelStyle(doc);
  doc.text(netSalaryLabel, LABEL_RIGHT, y);
  setValueStyle(doc, 11);
  const netValueWidth = doc.getTextWidth(netSalaryValue);
  doc.text(netSalaryValue, VALUE_RIGHT, y, { align: "right" });
  drawEurBadge(doc, VALUE_RIGHT - netValueWidth - 10.5, y);

  y += 9;
  drawLabelValueRow(
    doc,
    "Salary for worked hours:",
    formatEuro(data.salaryForHours),
    LABEL_LEFT,
    VALUE_LEFT,
    y,
  );
  drawLabelValueRow(
    doc,
    "Travel allowance",
    formatEuro(data.travelAllowance),
    LABEL_RIGHT,
    VALUE_RIGHT,
    y,
    11,
    "right",
  );

  y += 7;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.15);
  doc.line(LABEL_RIGHT, y, VALUE_RIGHT, y);

  y += 7;
  setLabelStyle(doc);
  doc.text("Total paid", LABEL_RIGHT, y);
  setValueStyle(doc, 11);
  doc.text(formatEuro(data.totalPaid), VALUE_RIGHT, y, { align: "right" });

  drawBlueSeparator(doc, FOOTER_SEPARATOR_Y, BORDER_X + 2, borderRight - 2);
  doc.setDrawColor(...SEPARATOR_RGB);
  doc.setLineWidth(SEPARATOR_LINE_WIDTH);
  doc.line(FOOTER_DIVIDER_X, FOOTER_SEPARATOR_Y, FOOTER_DIVIDER_X, borderBottom - 2);

  setLabelStyle(doc);
  doc.text("Holiday money earned:", LABEL_LEFT, FOOTER_Y);
  setValueStyle(doc, 12);
  doc.text(formatEuro(data.holidayMoney), VALUE_LEFT, FOOTER_Y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...FOOTER_RED_RGB);
  const footerLines = [
    "These are your net earnings for this week.",
    "Gross income, contributions and taxes are available",
    "only at month level in the monthly payslips.",
  ];
  footerLines.forEach((line, index) => {
    doc.text(line, RED_TEXT_X, FOOTER_Y + index * 3.2);
  });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(BORDER_LINE_WIDTH);
  doc.rect(BORDER_X, BORDER_Y, BORDER_W, BORDER_H, "S");

  return doc;
}

export function generateWeeklyPayslip(data: PayslipData): void {
  const doc = buildPayslipDocument(data);
  const safeName =
    sanitizeFilePart(data.employeeName) || `employee_${data.employeeId}`;
  const suffix =
    data.payslipType === "monthly"
      ? `${data.monthYear ?? data.year}_${String(data.month ?? 1).padStart(2, "0")}`
      : `${data.weekNumber}_${data.year}`;
  doc.save(`fluturas_${safeName}_${suffix}.pdf`);
}

export function openWeeklyPayslipPreview(data: PayslipData): void {
  const doc = buildPayslipDocument(data);
  const url = doc.output("bloburl");
  window.open(url, "_blank", "noopener,noreferrer");
}

export function weeklyPayslipPdfBytes(data: PayslipData): Uint8Array {
  const doc = buildPayslipDocument(data);
  return new Uint8Array(doc.output("arraybuffer"));
}

function toMoney(value: unknown): number {
  const n =
    typeof value === "object" && value !== null && "toString" in value
      ? Number(String(value))
      : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatDateLabel(value: unknown): string {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

export async function fetchEmployerDetailsForPayslip(): Promise<PayslipEmployerDetails> {
  const res = await fetch("/api/settings", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    return {};
  }
  const data = (await res.json().catch(() => ({}))) as PayslipEmployerDetails;
  return {
    companyName: data.companyName,
    companyAddress: data.companyAddress,
  };
}

export function mapPayslipApiResponseToPayslipData(
  payslip: {
    type?: string | null;
    employeeId: number;
    weekNumber: number;
    year: number;
    month?: number | null;
    monthYear?: number | null;
    periodStart: string | Date;
    periodEnd: string | Date;
    netTotal?: unknown;
    totalPaid: unknown;
    employee: {
      firstName: string;
      lastName: string;
      position?: string | null;
    };
    company?: { name: string; address?: string | null };
    timesheet: { hoursWorked: unknown };
    items?: Array<{ type: string; amount: unknown }>;
  },
  employer?: PayslipEmployerDetails,
): PayslipData {
  const payslipType =
    payslip.type === "monthly" || payslip.type === "weekly"
      ? payslip.type
      : "weekly";

  const netSalary = toMoney(
    payslipType === "monthly"
      ? (payslip.netTotal ?? 0)
      : (payslip.items?.find((item) => item.type === "NET_SALARY")?.amount ?? 0),
  );
  const grossSalary = toMoney(
    payslip.items?.find((item) => item.type === "GROSS_SALARY")?.amount ?? 0,
  );
  const casAmount = toMoney(
    payslip.items?.find((item) => item.type === "CAS")?.amount ?? 0,
  );
  const cassAmount = toMoney(
    payslip.items?.find((item) => item.type === "CASS")?.amount ?? 0,
  );
  const taxAmount = toMoney(
    payslip.items?.find((item) => item.type === "INCOME_TAX")?.amount ?? 0,
  );
  const travelAllowance = toMoney(
    payslip.items?.find((item) => item.type === "TRAVEL_ALLOWANCE")?.amount ??
      0,
  );
  const holidayMoney = toMoney(
    payslip.items?.find((item) => item.type === "HOLIDAY_MONEY")?.amount ?? 0,
  );
  const hoursWorked = toMoney(payslip.timesheet.hoursWorked);
  const hourlyRate =
    hoursWorked > 0 && payslipType === "weekly" ? netSalary / hoursWorked : 0;
  const employeeName =
    `${String(payslip.employee.lastName ?? "").trim()} ${String(
      payslip.employee.firstName ?? "",
    ).trim()}`.trim() || "-";

  const settingsCompanyName = String(employer?.companyName ?? "").trim();
  const settingsCompanyAddress = String(employer?.companyAddress ?? "").trim();

  return {
    payslipType,
    month: payslip.month,
    monthYear: payslip.monthYear,
    grossSalary,
    casAmount,
    cassAmount,
    taxAmount,
    companyName:
      settingsCompanyName ||
      payslip.company?.name?.trim() ||
      "Company Name",
    companyAddress:
      settingsCompanyAddress ||
      payslip.company?.address?.trim() ||
      "Address",
    employeeName,
    employeeId: String(payslip.employeeId),
    position: String(payslip.employee.position ?? "-"),
    weekNumber: payslip.weekNumber,
    year: payslip.year,
    periodStart: formatDateLabel(payslip.periodStart),
    periodEnd: formatDateLabel(payslip.periodEnd),
    hoursWorked,
    hourlyRate,
    salaryForHours: payslipType === "monthly" ? grossSalary : netSalary,
    netSalary,
    travelAllowance,
    totalPaid: toMoney(payslip.totalPaid),
    holidayMoney,
  };
}
