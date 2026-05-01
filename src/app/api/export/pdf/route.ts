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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditFF } from "@/lib/audit";
import { getAppSettings } from "@/lib/appSettings";
import { decrypt } from "@/lib/encryption";
import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";

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

    if (employeeIds.length > 5000) {
      return NextResponse.json({ error: "Maxim 5000 angajați per export" }, { status: 400 });
    }

    const appSettings = await getAppSettings();
    // Query employees
    const employees = await prisma.employee.findMany({
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
      "Bancă",
      "Tip plată",
      "Sumă brută",
      "Monedă",
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
      typeof emp.salaryAmount === "number" ? String(emp.salaryAmount) : "—",
      emp.salaryCurrency ?? "—",
      emp.status === "ACTIVE" ? "Activ" : "Terminat",
    ]);

    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 842; // landscape-like A4 width in points
    const pageHeight = 595; // landscape-like A4 height
    const margin = 24;
    const rowHeight = 18;
    const headerYTop = pageHeight - margin;
    const generatedAt = new Date().toLocaleString("ro-RO");
    const title = `Raport salarial — ${appSettings.companyName || "Companie"}`;
    const tableColWidths = [28, 78, 78, 92, 128, 78, 64, 66, 44, 58];

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = headerYTop;

    const drawPageHeader = (targetPage: PDFPage) => {
      targetPage.drawText(title, {
        x: margin,
        y: pageHeight - margin,
        size: 12,
        font: fontBold,
        color: rgb(0.12, 0.12, 0.12),
      });
      targetPage.drawText(`${appSettings.companyCuiReg || "CUI nedefinit"} · ${generatedAt}`, {
        x: margin,
        y: pageHeight - margin - 14,
        size: 9,
        font: fontRegular,
        color: rgb(0.35, 0.35, 0.35),
      });
    };

    const drawFooter = (targetPage: PDFPage, totalRows: number) => {
      targetPage.drawText(`Generat la ${generatedAt} — Total angajați: ${totalRows}`, {
        x: margin,
        y: 10,
        size: 9,
        font: fontRegular,
        color: rgb(0.35, 0.35, 0.35),
      });
    };

    const drawHeaderRow = (targetPage: PDFPage, rowY: number) => {
      let x = margin;
      for (let i = 0; i < headers.length; i++) {
        const label = headers[i] ?? "";
        const width = tableColWidths[i] ?? 50;
        targetPage.drawRectangle({
          x,
          y: rowY - rowHeight + 2,
          width,
          height: rowHeight,
          color: rgb(0.92, 0.94, 0.97),
        });
        targetPage.drawText(label, {
          x: x + 3,
          y: rowY - 11,
          size: 8,
          font: fontBold,
          color: rgb(0.15, 0.15, 0.15),
        });
        x += width;
      }
    };

    drawPageHeader(page);
    y = pageHeight - margin - 34;
    drawHeaderRow(page, y);
    y -= rowHeight;

    for (let r = 0; r < rows.length; r++) {
      if (y < 30) {
        drawFooter(page, rows.length);
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        drawPageHeader(page);
        y = pageHeight - margin - 34;
        drawHeaderRow(page, y);
        y -= rowHeight;
      }
      const row = rows[r] ?? [];
      let x = margin;
      for (let c = 0; c < headers.length; c++) {
        const width = tableColWidths[c] ?? 50;
        const cellText = String(row[c] ?? "—").slice(0, 40);
        page.drawText(cellText, {
          x: x + 3,
          y: y - 11,
          size: 8,
          font: fontRegular,
          color: rgb(0.12, 0.12, 0.12),
        });
        x += width;
      }
      y -= rowHeight;
    }
    drawFooter(page, rows.length);

    const pdfBytes = await pdfDoc.save();

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
    return NextResponse.json({ error: "Eroare la generare PDF" }, { status: 500 });
  }
}
