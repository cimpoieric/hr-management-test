/**
 * POST /api/export/weekly-pay-pdf — Fișă plată săptămânală (PDF)
 *
 * Body: același ca /api/export/weekly-pay — { employeeIds, unitsByEmployeeId }
 */

import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditFF } from "@/lib/audit";
import {
  salaryAmountToJson,
  weeklyPaySalaryDataComplete,
  computeWeeklyPayTotal,
  parseWeeklyPayUnitsFromRequest,
  parseSalaryTypeInput,
} from "@/lib/salaryFields";
import { decrypt } from "@/lib/encryption";
import { getAppSettings } from "@/lib/appSettings";
import { addSettingsLogo, registerPdfFontWithFallback } from "@/lib/pdf/jsPdfBranding";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function safeDecrypt(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return decrypt(value);
  } catch {
    return value ?? "";
  }
}

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const employeeIds: number[] = Array.isArray(body.employeeIds)
      ? body.employeeIds.filter((id: unknown) => typeof id === "number" && id > 0)
      : [];

    if (employeeIds.length === 0) {
      return NextResponse.json({ error: "Niciun angajat selectat" }, { status: 400 });
    }

    const rawUnits: Record<string, unknown> =
      body.unitsByEmployeeId && typeof body.unitsByEmployeeId === "object"
        ? body.unitsByEmployeeId
        : body.hoursByEmployeeId && typeof body.hoursByEmployeeId === "object"
          ? body.hoursByEmployeeId
          : {};

    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        cnp: true,
        salaryType: true,
        salaryAmount: true,
        salaryCurrency: true,
      },
    });

    const orderMap = new Map(employeeIds.map((id, i) => [id, i]));
    employees.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

    const appSettings = await getAppSettings();
    const companyName = (appSettings.companyName || "").trim() || "—";

    const generatedAt = new Date().toLocaleString("ro-RO");
    /** Variante fara diacritice — afisare sigura in PDF (Helvetica fallback). */
    const titleLine = "Fisa plata saptamanala";
    const footerLine = "Date confidentiale - conform GDPR";

    const headers = [
      "Nume",
      "CNP",
      "Tip plata",
      "Suma bruta",
      "Moneda",
      "Perioada lucrata",
      "Total calculat",
    ];

    const rows: string[][] = employees.map((emp) => {
      const nume = `${String(emp.lastName ?? "").trim()} ${String(emp.firstName ?? "").trim()}`.trim();
      const cnp = safeDecrypt(emp.cnp);
      const ready = weeklyPaySalaryDataComplete(emp);
      const payTypeLabel = String(emp.salaryType ?? "").trim();
      const currency = (emp.salaryCurrency ?? "").trim();
      const basis = ready ? salaryAmountToJson(emp.salaryAmount) : null;
      const raw = rawUnits[String(emp.id)];
      const units = ready ? parseWeeklyPayUnitsFromRequest(raw, emp.salaryType) : 0;
      /** Fără perioadă lucrată (> 0) → „—” la perioadă și total (aliniat la UI Plată). */
      const hasWorkedPeriod = ready && units > 0;
      const total =
        hasWorkedPeriod && basis != null
          ? computeWeeklyPayTotal(emp.salaryType, units, emp.salaryAmount)
          : null;

      const sumaBruta =
        ready && basis != null
          ? basis.toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
          : "—";

      const payLabel = parseSalaryTypeInput(String(emp.salaryType ?? ""));
      const perioada =
        ready && hasWorkedPeriod
          ? units.toLocaleString("ro-RO", { maximumFractionDigits: 2 })
          : "—";

      const totalStr =
        total != null && hasWorkedPeriod && currency && payLabel
          ? `${total.toLocaleString("ro-RO", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })} ${currency}`
          : "—";

      return [
        nume || "—",
        cnp || "—",
        ready ? payTypeLabel : "—",
        sumaBruta,
        ready ? currency : "—",
        perioada,
        totalStr,
      ];
    });

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pdfFont = registerPdfFontWithFallback(doc);
    const marginLeft = 40;
    const topY = 12;
    const textX = addSettingsLogo(doc, marginLeft, topY, 48, 36);

    doc.setFont(pdfFont, "bold");
    doc.setFontSize(11);
    doc.text(companyName, textX, 26);
    doc.setFontSize(14);
    doc.text(titleLine, textX, 42);
    doc.setFont(pdfFont, "normal");
    doc.setFontSize(10);
    doc.text(`Generat: ${generatedAt}`, marginLeft, 58);

    const tableColWidths = [120, 92, 72, 72, 52, 88, 100];

    autoTable(doc, {
      startY: 72,
      head: [headers],
      body: rows,
      styles: {
        font: pdfFont,
        fontStyle: "normal",
        fontSize: 8,
        cellPadding: 4,
        overflow: "linebreak",
      },
      headStyles: {
        font: pdfFont,
        fontStyle: "bold",
        fillColor: [235, 240, 248],
        textColor: [25, 25, 25],
      },
      columnStyles: Object.fromEntries(tableColWidths.map((w, i) => [i, { cellWidth: w }])),
      margin: { left: 40, right: 40, bottom: 36 },
      didDrawPage: (data) => {
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFont(pdfFont, "italic");
        doc.setFontSize(8);
        doc.setTextColor(90, 90, 90);
        doc.text(footerLine, 40, pageHeight - 20);
        doc.setTextColor(0, 0, 0);
      },
    });

    const pdfBytes = new Uint8Array(doc.output("arraybuffer"));

    logAuditFF({
      action: "EXPORT_PDF",
      entity: "Employee",
      userId: user.userId,
      userRole: user.role,
      ipAddress: getClientIp(request),
      newValues: { kind: "WEEKLY_PAY_PDF", employeeCount: employees.length },
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="fisa-plata-saptamanala-${new Date().toISOString().slice(0, 10)}.pdf"`,
        "Content-Length": String(pdfBytes.byteLength),
      },
    });
  } catch (error) {
    console.error("[EXPORT_WEEKLY_PAY_PDF]", error);
    return NextResponse.json({ error: "Eroare la generare PDF" }, { status: 500 });
  }
}
