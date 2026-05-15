/**
 * POST /api/export/pdf — Export angajați selectați în format PDF
 *
 * Body: { employeeIds: number[], type?: "list" | "detailed" }
 *   - "list": tabel compact (default)
 *   - "detailed": tabel cu toate coloanele
 *
 * Protejat: orice rol autentificat.
 * Export contabilitate: date complete (nemascate).
 */

import { getAppSettings } from "@/lib/appSettings";
import { logAuditFF } from "@/lib/audit";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { decrypt } from "@/lib/encryption";
import {
  addSettingsLogo,
  registerPdfFontWithFallback,
} from "@/lib/pdf/jsPdfBranding";
import { checkPlan, FEATURES } from "@/lib/middleware/plan-check";
import { prismaTyped } from "@/lib/prisma";
import { salaryAmountToJson } from "@/lib/salaryFields";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { type NextRequest, NextResponse } from "next/server";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function safeDecrypt(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const planCheck = await checkPlan(request, FEATURES.EXPORT_PDF, {
    roles: ROLES_SETTINGS_ADMIN,
  });
  if (!planCheck.allowed) return planCheck.response;
  const { user } = planCheck;

  try {
    const body = await request.json();
    const employeeIds: number[] = Array.isArray(body.employeeIds)
      ? body.employeeIds.filter(
          (id: unknown) => typeof id === "number" && id > 0,
        )
      : [];

    if (employeeIds.length === 0) {
      return NextResponse.json(
        { error: "Niciun angajat selectat" },
        { status: 400 },
      );
    }

    if (employeeIds.length > 5000) {
      return NextResponse.json(
        { error: "Maxim 5000 angajați per export" },
        { status: 400 },
      );
    }

    const appSettings = await getAppSettings(user.organizationId);
    // Query employees
    const employees = await prismaTyped.employee.findMany({
      where: { id: { in: employeeIds } },
      orderBy: { lastName: "asc" },
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { documents: true, deployments: true } },
      },
    });

    if (employees.length === 0) {
      return NextResponse.json({ error: "Angajați negăsiți" }, { status: 404 });
    }

    const headers = [
      "Nr.",
      "Nume",
      "Prenume",
      "CNP",
      "IBAN",
      "Banca",
      "Tip plata",
      "Suma bruta",
      "Moneda",
      "Status",
    ];
    const rows = employees.map((emp, idx) => [
      String(idx + 1),
      emp.lastName ?? "—",
      emp.firstName ?? "—",
      emp.cnp ?? "—",
      safeDecrypt(emp.iban),
      emp.bankName ?? "—",
      emp.salaryType ?? "—",
      (() => {
        const n = salaryAmountToJson(emp.salaryAmount);
        return n != null ? String(n) : "—";
      })(),
      emp.salaryCurrency ?? "—",
      emp.status === "ACTIVE" ? "Activ" : "Terminat",
    ]);

    const generatedAt = new Date().toLocaleString("ro-RO");
    const companyLabel = (appSettings.companyName || "").trim() || "Companie";
    const tableColWidths = [28, 78, 78, 92, 128, 78, 64, 66, 44, 58];
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });
    const pdfFont = registerPdfFontWithFallback(doc);
    const marginLeft = 24;
    const textX = addSettingsLogo(doc, marginLeft, 12, 48, 36);
    doc.setFont(pdfFont, "bold");
    doc.setFontSize(11);
    doc.text(companyLabel, textX, 24);
    doc.setFontSize(12);
    doc.text("Raport salarial", textX, 38);
    doc.setFont(pdfFont, "normal");
    doc.setFontSize(9);
    doc.text(
      `${appSettings.companyCuiReg || "CUI nedefinit"} · ${generatedAt}`,
      marginLeft,
      54,
    );

    autoTable(doc, {
      startY: 66,
      head: [headers],
      body: rows,
      styles: {
        font: pdfFont,
        fontStyle: "normal",
        fontSize: 8,
        cellPadding: 3,
        overflow: "linebreak",
      },
      headStyles: {
        font: pdfFont,
        fontStyle: "bold",
        fillColor: [235, 240, 248],
        textColor: [25, 25, 25],
      },
      columnStyles: Object.fromEntries(
        tableColWidths.map((w, i) => [i, { cellWidth: w }]),
      ),
      margin: { left: 24, right: 24 },
      didDrawPage: () => {
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFont(pdfFont, "normal");
        doc.setFontSize(9);
        doc.text(
          `Generat la ${generatedAt} - Total angajati: ${rows.length}`,
          marginLeft,
          pageHeight - 12,
        );
      },
    });
    const pdfBytes = new Uint8Array(doc.output("arraybuffer"));

    // Audit log
    logAuditFF({
      action: "EXPORT_PDF",
      entity: "Employee",
      userId: user.userId,
      userRole: user.role,
      ipAddress: getClientIp(request),
      newValues: { employeeCount: employees.length, type: "accounting" },
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="export-angajati-${new Date().toISOString().slice(0, 10)}.pdf"`,
        "Content-Length": String(pdfBytes.byteLength),
      },
    });
  } catch (error) {
    console.error("[EXPORT_PDF]", error);
    return NextResponse.json(
      { error: "Eroare la generare PDF" },
      { status: 500 },
    );
  }
}
