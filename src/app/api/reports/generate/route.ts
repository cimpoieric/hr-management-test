/**
 * POST /api/reports/generate — Generează rapoarte PDF profesionale
 *
 * Body: {
 *   type: "lista" | "a1" | "tara" | "fisa",
 *   params?: { countryCode?: string, employeeId?: number },
 *   employeeIds?: number[],
 *   columns?: ColumnDef[]
 * }
 *
 * Returnează: { downloadUrl: string, reportId: string, expiresAt: string }
 *
 * Salvează PDF în ./data/reports/{uuid}.pdf (șters automat după 24h)
 * AuditLog: cine a generat ce raport, câți angajați inclusi
 */

import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile, stat } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prismaTyped } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditFF } from "@/lib/audit";
import { getAppSettings } from "@/lib/appSettings";
import { decrypt } from "@/lib/encryption";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  generateA1ReportPDF,
  generateCountryReportPDF,
  generateEmployeeSheetPDF,
  type ColumnDef,
  type EmployeeListItem,
} from "@/lib/pdfGenerator";
import { DEPLOYMENT_COUNTRIES } from "@/lib/countries";
import { salaryAmountToJson } from "@/lib/salaryFields";
import { addSettingsLogo, registerPdfFontWithFallback } from "@/lib/pdf/jsPdfBranding";

// ─── Constants ───────────────────────────────────────────────────────────────

const REPORTS_DIR = join(process.cwd(), "data", "reports");
const REPORT_TTL_MS = 24 * 60 * 60 * 1000; // 24 ore

// ─── Types ───────────────────────────────────────────────────────────────────

type ReportType = "lista" | "a1" | "tara" | "fisa";

interface GenerateRequest {
  type: ReportType;
  params?: {
    countryCode?: string;
    employeeId?: number;
  };
  employeeIds?: number[];
  columns?: ColumnDef[];
  title?: string;
}

/** Rând din listă + companie + countryId (rezolvat separat prin tabela Country). */
type ListaReportEmployee = {
  id: number;
  lastName: string;
  firstName: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  status: string;
  city: string | null;
  hiredAt: Date;
  cnp: string;
  iban: string | null;
  bankName: string | null;
  salaryType: string | null;
  salaryAmount: Prisma.Decimal | null;
  salaryCurrency: string;
  salaryStartDate: Date | null;
  countryId: number | null;
  company: { id: number; name: string } | null;
  _count: { documents: number; deployments: number };
};

type FisaReportEmployee = {
  id: number;
  lastName: string;
  firstName: string;
  cnp: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  status: string;
  city: string | null;
  address: string | null;
  hiredAt: Date;
  iban: string | null;
  bankName: string | null;
  observations: string | null;
  seriesCI: string | null;
  numberCI: string | null;
  salaryType: string | null;
  salaryAmount: Prisma.Decimal | null;
  salaryCurrency: string;
  salaryStartDate: Date | null;
  countryId: number | null;
  company: { name: string } | null;
  documents: Array<{
    type: string;
    number: string | null;
    status: string;
    issueDate: Date | null;
    expiryDate: Date | null;
  }>;
  deployments: Array<{
    country: string;
    city: string | null;
    startDate: Date;
    endDate: Date | null;
    status: string;
    notes: string | null;
  }>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureReportsDir(): Promise<void> {
  if (!existsSync(REPORTS_DIR)) {
    await mkdir(REPORTS_DIR, { recursive: true });
  }
}

async function cleanupOldReports(): Promise<void> {
  try {
    const { readdir, unlink } = await import("fs/promises");
    const files = await readdir(REPORTS_DIR);
    const now = Date.now();
    for (const file of files) {
      if (!file.endsWith(".pdf")) continue;
      const filePath = join(REPORTS_DIR, file);
      const stats = await stat(filePath);
      if (now - stats.mtimeMs > REPORT_TTL_MS) {
        await unlink(filePath);
      }
    }
  } catch {
    // ignore cleanup errors
  }
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function getLogoPath(): string | null {
  const logoPath = join(process.cwd(), "data", "settings", "logo.png");
  return existsSync(logoPath) ? logoPath : null;
}

async function fetchCountriesByIds(
  ids: number[]
): Promise<Map<number, { name: string; code: string }>> {
  if (ids.length === 0) return new Map();
  const rows = await prismaTyped.$queryRaw<Array<{ id: number; name: string; code: string }>>`
    SELECT id, name, code FROM Country WHERE id IN (${Prisma.join(ids)})
  `;
  return new Map(rows.map((r) => [r.id, r]));
}

// ─── Default columns for list report ─────────────────────────────────────────

const DEFAULT_LIST_COLUMNS: ColumnDef[] = [
  { key: "lastName", header: "Nume", width: 18 },
  { key: "firstName", header: "Prenume", width: 16 },
  { key: "cnp", header: "CNP", width: 16 },
  { key: "iban", header: "IBAN", width: 26 },
  { key: "bankName", header: "Banca", width: 16 },
  { key: "salaryType", header: "Tip plata", width: 12 },
  { key: "salaryAmount", header: "Suma bruta", width: 12 },
  { key: "salaryCurrency", header: "Moneda", width: 10 },
  { key: "salaryStartDate", header: "Valabil de la", width: 14 },
  { key: "companyName", header: "Firma", width: 22 },
  { key: "position", header: "Functie", width: 18 },
  { key: "country", header: "Tara", width: 12 },
  { key: "status", header: "Status", width: 12 },
];

function safeDecrypt(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

async function generateAccountingListPdf(params: {
  employees: Array<{
    firstName: string;
    lastName: string;
    cnp: string;
    iban: string | null;
    bankName: string | null;
    salaryType: string | null;
    salaryAmount: number | null;
    salaryCurrency: string;
    status: string;
  }>;
  companyName: string;
  companyRef: string;
  title: string;
}): Promise<Uint8Array> {
  const { employees, companyName, companyRef, title } = params;
  const generatedAt = new Date().toLocaleString("ro-RO");
  const headers = ["Nr.", "Nume", "Prenume", "CNP", "IBAN", "Banca", "Tip plata", "Suma bruta", "Moneda", "Status"];
  const widths = [28, 78, 78, 92, 128, 78, 64, 66, 44, 58];
  const rows = employees.map((e, idx) => [
    String(idx + 1),
    e.lastName || "—",
    e.firstName || "—",
    e.cnp || "—",
    safeDecrypt(e.iban),
    e.bankName || "—",
    e.salaryType || "—",
    typeof e.salaryAmount === "number" ? String(e.salaryAmount) : "—",
    e.salaryCurrency || "—",
    e.status === "ACTIVE" ? "Activ" : "Terminat",
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pdfFont = registerPdfFontWithFallback(doc);
  const ml = 24;
  const tx = addSettingsLogo(doc, ml, 12, 48, 36);
  const firm = (companyName || "").trim() || "Companie";
  doc.setFont(pdfFont, "bold");
  doc.setFontSize(11);
  doc.text(firm, tx, 24);
  doc.setFontSize(11);
  doc.text(title, tx, 38);
  doc.setFont(pdfFont, "normal");
  doc.setFontSize(9);
  doc.text(`${companyRef || "CUI nedefinit"} · ${generatedAt}`, ml, 54);

  autoTable(doc, {
    startY: 64,
    head: [headers],
    body: rows,
    styles: { font: pdfFont, fontSize: 8, cellPadding: 3, overflow: "linebreak" },
    headStyles: { font: pdfFont, fontStyle: "bold", fillColor: [235, 240, 248], textColor: [25, 25, 25] },
    columnStyles: Object.fromEntries(widths.map((w, i) => [i, { cellWidth: w }])),
    margin: { left: 24, right: 24 },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFont(pdfFont, "normal");
      doc.setFontSize(9);
      doc.text(`Generat la ${generatedAt} - Total angajati: ${rows.length}`, ml, pageHeight - 12);
    },
  });
  const ab = doc.output("arraybuffer");
  return new Uint8Array(ab);
}

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const body: GenerateRequest = await request.json();
    const reportType = body.type;

    if (!["lista", "a1", "tara", "fisa"].includes(reportType)) {
      return NextResponse.json({ error: "Tip raport invalid" }, { status: 400 });
    }

    await ensureReportsDir();
    await cleanupOldReports();

    const logoPath = getLogoPath();
    const appSettings = await getAppSettings();
    const generatedBy = user.email;
    let pdfBytes: Uint8Array;
    let reportTitle: string;
    let employeeCount = 0;

    // ─── Generate based on type ───────────────────────────────────────────

    if (reportType === "lista") {
      // ─── Raport Listă ───────────────────────────────────────────────────
      const employeeIds = body.employeeIds ?? [];
      if (employeeIds.length === 0) {
        return NextResponse.json({ error: "Niciun angajat selectat" }, { status: 400 });
      }
      if (employeeIds.length > 5000) {
        return NextResponse.json({ error: "Maxim 5000 angajati" }, { status: 400 });
      }

      const columns = body.columns && body.columns.length > 0 ? body.columns : DEFAULT_LIST_COLUMNS;

      const employees = (await prismaTyped.employee.findMany({
        where: { id: { in: employeeIds } },
        orderBy: { lastName: "asc" },
        select: {
          id: true,
          lastName: true,
          firstName: true,
          email: true,
          phone: true,
          position: true,
          status: true,
          city: true,
          hiredAt: true,
          cnp: true,
          iban: true,
          bankName: true,
          salaryType: true,
          salaryAmount: true,
          salaryCurrency: true,
          salaryStartDate: true,
          countryId: true,
          company: { select: { id: true, name: true } },
          _count: { select: { documents: true, deployments: true } },
        } as unknown as Prisma.EmployeeSelect,
      })) as unknown as ListaReportEmployee[];
      const countryIds = [
        ...new Set(employees.map((e) => e.countryId).filter((id): id is number => id != null)),
      ];
      const countryById = await fetchCountriesByIds(countryIds);

      console.log("[PDF DATA]", employees);
      console.log("[PDF DATA] employees length:", employees?.length);

      const items: EmployeeListItem[] = employees.map((e) => {
        const cr = e.countryId != null ? countryById.get(e.countryId) : undefined;
        return {
          id: e.id,
          lastName: e.lastName,
          firstName: e.firstName,
          email: e.email,
          phone: e.phone,
          position: e.position,
          status: e.status,
          companyName: e.company?.name ?? null,
          country: cr ? `${cr.name} (${cr.code})` : null,
          city: e.city,
          hiredAt: e.hiredAt,
          cnp: e.cnp,
          iban: e.iban,
          bankName: e.bankName,
          salaryType: e.salaryType ?? null,
          salaryAmount: salaryAmountToJson(e.salaryAmount),
          salaryCurrency: e.salaryCurrency,
          salaryStartDate: e.salaryStartDate,
        };
      });

      reportTitle = body.title ?? "Raport salarial - confidential";
      employeeCount = items.length;

      void columns;
      void logoPath;
      void generatedBy;
      pdfBytes = await generateAccountingListPdf({
        employees: employees.map((e) => ({
          firstName: e.firstName,
          lastName: e.lastName,
          cnp: e.cnp,
          iban: e.iban,
          bankName: e.bankName,
          salaryType: e.salaryType ?? null,
          salaryAmount: salaryAmountToJson(e.salaryAmount),
          salaryCurrency: e.salaryCurrency,
          status: e.status,
        })),
        companyName: appSettings.companyName || "",
        companyRef: appSettings.companyCuiReg || "",
        title: reportTitle,
      });

    } else if (reportType === "a1") {
      // ─── Raport A1 ──────────────────────────────────────────────────────
      const today = new Date();

      // Find employees with active deployments
      const activeDeployments = await prismaTyped.deployment.findMany({
        where: {
          status: "ACTIVE",
          OR: [{ endDate: null }, { endDate: { gte: today } }],
        },
        select: { employeeId: true, country: true, city: true },
        distinct: ["employeeId"],
      });

      const employeeIds = activeDeployments.map((d) => d.employeeId);
      if (employeeIds.length === 0) {
        return NextResponse.json({ error: "Niciun angajat cu detasare activa" }, { status: 404 });
      }

      // Get A1 documents for these employees
      const a1Docs = await prismaTyped.document.findMany({
        where: {
          employeeId: { in: employeeIds },
          type: "A1",
        },
        select: {
          employeeId: true,
          status: true,
          expiryDate: true,
        },
        orderBy: { uploadedAt: "desc" },
      });

      const a1ByEmployee = new Map<number, { status: string; expiryDate: Date | null }>();
      for (const doc of a1Docs) {
        if (!a1ByEmployee.has(doc.employeeId)) {
          a1ByEmployee.set(doc.employeeId, { status: doc.status, expiryDate: doc.expiryDate });
        }
      }

      const employees = await prismaTyped.employee.findMany({
        where: { id: { in: employeeIds } },
        orderBy: { lastName: "asc" },
        include: {
          company: { select: { name: true } },
        },
      });

      const deploymentMap = new Map<number, { country: string; city: string | null }>();
      for (const d of activeDeployments) {
        deploymentMap.set(d.employeeId, { country: d.country, city: d.city });
      }

      const items: EmployeeListItem[] = employees.map((e) => {
        const dep = deploymentMap.get(e.id);
        const a1 = a1ByEmployee.get(e.id);
        return {
          id: e.id,
          lastName: e.lastName,
          firstName: e.firstName,
          status: e.status,
          companyName: e.company?.name ?? null,
          deploymentCountry: dep?.country ?? null,
          deploymentCity: dep?.city ?? null,
          a1Status: a1?.status ?? null,
          a1Expiry: a1?.expiryDate ?? null,
        };
      });

      reportTitle = body.title ?? "Raport A1 — Status certificate";
      employeeCount = items.length;

      pdfBytes = generateA1ReportPDF({
        employees: items,
        title: reportTitle,
        generatedBy,
        logoPath,
      });

    } else if (reportType === "tara") {
      // ─── Raport Țară ────────────────────────────────────────────────────
      const countryCode = body.params?.countryCode;
      if (!countryCode) {
        return NextResponse.json({ error: "Cod tara necesar" }, { status: 400 });
      }

      const countryInfo = DEPLOYMENT_COUNTRIES.find((c) => c.code === countryCode);
      const countryName = countryInfo?.name ?? countryCode;

      const today = new Date();
      const deployments = await prismaTyped.deployment.findMany({
        where: {
          country: countryCode,
          status: { not: "CANCELLED" },
          OR: [{ endDate: null }, { endDate: { gte: today } }],
        },
        select: {
          employeeId: true,
          city: true,
          startDate: true,
          endDate: true,
          status: true,
        },
      });

      const employeeIds = deployments.map((d) => d.employeeId);
      if (employeeIds.length === 0) {
        return NextResponse.json({ error: "Niciun angajat in aceasta tara" }, { status: 404 });
      }

      const employees = await prismaTyped.employee.findMany({
        where: { id: { in: employeeIds } },
        orderBy: { lastName: "asc" },
        include: {
          company: { select: { name: true } },
        },
      });

      const depMap = new Map<number, { city: string | null; startDate: Date; endDate: Date | null; status: string }>();
      for (const d of deployments) {
        depMap.set(d.employeeId, d);
      }

      const items: EmployeeListItem[] = employees.map((e) => {
        const dep = depMap.get(e.id);
        return {
          id: e.id,
          lastName: e.lastName,
          firstName: e.firstName,
          status: e.status,
          position: e.position,
          companyName: e.company?.name ?? null,
          city: e.city,
          deploymentCity: dep?.city ?? null,
          deploymentCountry: countryCode,
        };
      });

      reportTitle = body.title ?? `Raport detasari — ${countryName}`;
      employeeCount = items.length;

      pdfBytes = generateCountryReportPDF({
        employees: items,
        countryName,
        countryCode,
        title: reportTitle,
        generatedBy,
        logoPath,
      });

    } else {
      // ─── Raport Fișă Angajat ────────────────────────────────────────────
      const employeeId = body.params?.employeeId ?? (body.employeeIds?.[0]);
      if (!employeeId) {
        return NextResponse.json({ error: "ID angajat necesar" }, { status: 400 });
      }

      const employee = (await prismaTyped.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          lastName: true,
          firstName: true,
          cnp: true,
          email: true,
          phone: true,
          position: true,
          status: true,
          city: true,
          address: true,
          hiredAt: true,
          iban: true,
          bankName: true,
          observations: true,
          seriesCI: true,
          numberCI: true,
          salaryType: true,
          salaryAmount: true,
          salaryCurrency: true,
          salaryStartDate: true,
          countryId: true,
          company: { select: { name: true } },
          documents: {
            orderBy: { type: "asc" },
            select: {
              type: true,
              number: true,
              status: true,
              issueDate: true,
              expiryDate: true,
            },
          },
          deployments: {
            orderBy: { startDate: "desc" },
            select: {
              country: true,
              city: true,
              startDate: true,
              endDate: true,
              status: true,
              notes: true,
            },
          },
        } as unknown as Prisma.EmployeeSelect,
      })) as FisaReportEmployee | null;

      if (!employee) {
        return NextResponse.json({ error: "Angajat negasit" }, { status: 404 });
      }

      let countryDisplay = "—";
      if (employee.countryId != null) {
        const rows = await prismaTyped.$queryRaw<Array<{ name: string; code: string }>>`
          SELECT name, code FROM Country WHERE id = ${employee.countryId} LIMIT 1
        `;
        const cr = rows[0];
        if (cr) countryDisplay = `${cr.name} (${cr.code})`;
      }

      reportTitle = body.title ?? `Fisa angajat — ${employee.lastName} ${employee.firstName}`;
      employeeCount = 1;

      pdfBytes = generateEmployeeSheetPDF({
        employee: {
          id: employee.id,
          lastName: employee.lastName,
          firstName: employee.firstName,
          cnp: employee.cnp ?? undefined,
          email: employee.email,
          phone: employee.phone,
          position: employee.position,
          status: employee.status,
          companyName: employee.company?.name ?? null,
          country: countryDisplay,
          city: employee.city,
          address: employee.address,
          hiredAt: employee.hiredAt,
          iban: employee.iban ?? null,
          bankName: employee.bankName,
          observations: employee.observations,
          seriesCI: employee.seriesCI,
          numberCI: employee.numberCI,
          salaryType: employee.salaryType ?? null,
          salaryAmount: salaryAmountToJson(employee.salaryAmount),
          salaryCurrency: employee.salaryCurrency,
          salaryStartDate: employee.salaryStartDate,
        },
        documents: employee.documents,
        deployments: employee.deployments,
        title: reportTitle,
        generatedBy,
        logoPath,
      });
    }

    // ─── Save PDF ─────────────────────────────────────────────────────────
    const reportId = randomUUID();
    const fileName = `${reportId}.pdf`;
    const filePath = join(REPORTS_DIR, fileName);

    await writeFile(filePath, Buffer.from(pdfBytes));

    const expiresAt = new Date(Date.now() + REPORT_TTL_MS);

    // ─── Audit Log ────────────────────────────────────────────────────────
    logAuditFF({
      action: "REPORT_GENERATE",
      entity: "Report",
      userId: user.userId,
      userName: user.email,
      userRole: user.role,
      ipAddress: getClientIp(request),
      newValues: {
        type: reportType,
        title: reportTitle,
        employeeCount,
        reportId,
      },
    });

    return NextResponse.json({
      reportId,
      downloadUrl: `/api/reports/download/${reportId}`,
      expiresAt: expiresAt.toISOString(),
      title: reportTitle,
      employeeCount,
    });

  } catch (error) {
    console.log("[PDF ERROR]", error);
    console.error("[REPORTS_GENERATE]", error);
    return NextResponse.json({ error: "Eroare la generare raport" }, { status: 500 });
  }
}
