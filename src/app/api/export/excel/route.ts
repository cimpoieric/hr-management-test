/**
 * POST /api/export/excel — Export angajați selectați în format Excel (.xlsx)
 *
 * Body: { employeeIds: number[], columns?: string[] }
 * Coloane default: id, firstName, lastName, cnp, email, phone, status, position, company
 *
 * Protejat: orice rol autentificat.
 * Export contabilitate: date complete (CNP/IBAN nemascate).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditFF } from "@/lib/audit";
import * as XLSX from "xlsx";

// ─── Coloane disponibile ─────────────────────────────────────────────────────

interface ColumnDef {
  key: string;
  header: string;
  width: number;
  format?: (val: unknown, emp: Record<string, unknown>) => string | number;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "id", header: "ID", width: 8 },
  { key: "lastName", header: "Nume", width: 18 },
  { key: "firstName", header: "Prenume", width: 18 },
  { key: "cnp", header: "CNP", width: 16 },
  { key: "seriesCI", header: "Serie CI", width: 8 },
  { key: "numberCI", header: "Număr CI", width: 12 },
  { key: "email", header: "Email", width: 28 },
  { key: "phone", header: "Telefon", width: 14 },
  { key: "position", header: "Funcție", width: 20 },
  { key: "status", header: "Status", width: 12 },
  { key: "company", header: "Firmă", width: 22, format: (_v, emp) => (emp.companyName as string) ?? "" },
  { key: "address", header: "Adresă", width: 28 },
  { key: "city", header: "Oraș", width: 16 },
  { key: "country", header: "Țară", width: 10 },
  { key: "hiredAt", header: "Data angajării", width: 16, format: (v) => v ? new Date(v as string).toLocaleDateString("ro-RO") : "" },
  { key: "iban", header: "IBAN", width: 28 },
  { key: "bankName", header: "Bancă", width: 18 },
  { key: "salaryType", header: "Tip plată", width: 14 },
  { key: "salaryAmount", header: "Sumă brută", width: 14 },
  { key: "salaryCurrency", header: "Monedă", width: 10 },
  { key: "salaryStartDate", header: "Valabil de la", width: 14, format: (v) => v ? new Date(v as string).toLocaleDateString("ro-RO") : "" },
  { key: "observations", header: "Observații", width: 35 },
];

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

    // Coloane solicitate sau default
    const requestedColumns: string[] = Array.isArray(body.columns) && body.columns.length > 0
      ? body.columns
      : [
        "id", "lastName", "firstName", "cnp", "iban", "bankName", "email", "phone",
        "status", "position", "company", "salaryType", "salaryAmount", "salaryCurrency", "salaryStartDate",
      ];

    // Query employees
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      orderBy: { lastName: "asc" },
      include: {
        company: { select: { id: true, name: true } },
      },
    });

    if (employees.length === 0) {
      return NextResponse.json({ error: "Angajați negăsiți" }, { status: 404 });
    }

    // Selectează doar coloanele cerute care există
    const activeColumns = ALL_COLUMNS.filter((c) => requestedColumns.includes(c.key));
    if (activeColumns.length === 0) {
      return NextResponse.json({ error: "Nicio coloană validă selectată" }, { status: 400 });
    }

    // Construiește header row
    const headers = activeColumns.map((c) => c.header);

    // Construiește data rows
    const rows = employees.map((emp) => {
      const flatEmp: Record<string, unknown> = {
        ...emp,
        companyName: emp.company?.name ?? "—",
      };

      return activeColumns.map((col) => {
        const rawValue = flatEmp[col.key];
        if (col.format) {
          return col.format(rawValue, flatEmp);
        }
        return rawValue ?? "";
      });
    });

    // Crează workbook
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Setează lățimi coloane
    ws["!cols"] = activeColumns.map((c) => ({ wch: c.width }));

    // Setează înălțime header
    ws["!rows"] = [{ hpt: 22 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Angajati");

    // Generează buffer
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Audit log
    logAuditFF({
      action: "EXPORT_EXCEL",
      entity: "Employee",
      userId: user.userId,
      userRole: user.role,
      ipAddress: getClientIp(request),
      newValues: { employeeCount: employees.length, columns: requestedColumns },
    });

    // Returnează ca attachment
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="export-angajati-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        "Content-Length": String(buf.byteLength),
      },
    });
  } catch (error) {
    console.error("[EXPORT_EXCEL]", error);
    return NextResponse.json({ error: "Eroare la generare Excel" }, { status: 500 });
  }
}
