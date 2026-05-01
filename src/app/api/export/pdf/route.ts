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
import { generatePDF } from "@/lib/pdfGenerator";
import { logAuditFF } from "@/lib/audit";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
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

    const exportType = body.type === "detailed" ? "detailed" : "list";
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

    // Construiește tabel
    const headers =
      exportType === "detailed"
        ? ["ID", "Nume", "Prenume", "CNP", "Email", "Telefon", "Functie", "Status", "Firma", "Oras", "Data Angajarii", "IBAN", "Banca", "Tip plata", "Suma bruta", "Moneda", "Valabil de la", "Doc.", "Det."]
        : ["Nume", "Prenume", "CNP", "IBAN", "Banca", "Tip plata", "Suma bruta", "Moneda", "Status", "Firma"];

    const colWidths =
      exportType === "detailed"
        ? [6, 14, 14, 14, 18, 12, 12, 10, 14, 10, 12, 20, 12, 10, 12, 10, 12, 6, 6]
        : [14, 14, 14, 20, 12, 10, 12, 10, 10, 14];

    const rows = employees.map((emp) => {
      if (exportType === "detailed") {
        return [
          String(emp.id),
          emp.lastName,
          emp.firstName,
          emp.cnp ?? "—",
          emp.email ?? "—",
          emp.phone ?? "—",
          emp.position ?? "—",
          emp.status === "ACTIVE" ? "Activ" : "Terminat",
          emp.company?.name ?? "—",
          emp.city ?? "—",
          emp.hiredAt ? new Date(emp.hiredAt).toLocaleDateString("ro-RO") : "—",
          emp.iban ?? "—",
          emp.bankName ?? "—",
          emp.salaryType ?? "—",
          typeof emp.salaryAmount === "number" ? String(emp.salaryAmount) : "—",
          emp.salaryCurrency ?? "—",
          emp.salaryStartDate ? new Date(emp.salaryStartDate).toLocaleDateString("ro-RO") : "—",
          String(emp._count.documents),
          String(emp._count.deployments),
        ];
      }

      return [
        emp.lastName,
        emp.firstName,
        emp.cnp ?? "—",
        emp.iban ?? "—",
        emp.bankName ?? "—",
        emp.salaryType ?? "—",
        typeof emp.salaryAmount === "number" ? String(emp.salaryAmount) : "—",
        emp.salaryCurrency ?? "—",
        emp.status === "ACTIVE" ? "Activ" : "Terminat",
        emp.company?.name ?? "—",
      ];
    });

    // Generează PDF
    const pdfBytes = generatePDF({
      title: `Raport Angajati — ${exportType === "detailed" ? "Detaliat" : "Lista"}`,
      header: `HR Management — Export din ${new Date().toLocaleDateString("ro-RO")} — ${employees.length} angajati`,
      footer: `Generat de ${user.email} | pagina`,
      tables: [{ headers, rows, colWidths }],
    });

    // Audit log
    logAuditFF({
      action: "EXPORT_PDF",
      entity: "Employee",
      userId: user.userId,
      userRole: user.role,
      ipAddress: getClientIp(request),
      newValues: { employeeCount: employees.length, type: exportType },
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
