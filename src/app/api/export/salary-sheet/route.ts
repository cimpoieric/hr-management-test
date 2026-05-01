import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditFF } from "@/lib/audit";
import { getAppSettings } from "@/lib/appSettings";
import { decrypt } from "@/lib/encryption";
import { parseSalaryTypeInput, salaryAmountToJson } from "@/lib/salaryFields";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function statusLabel(status: string): string {
  if (status === "ACTIVE") return "Activ";
  if (status === "TERMINATED") return "Terminat";
  return status;
}

function csvEscape(value: string): string {
  if (/[;"\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function safeDecrypt(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const formatRaw = typeof body.format === "string" ? body.format.trim().toLowerCase() : "xlsx";
    const format = formatRaw === "csv" ? "csv" : "xlsx";

    const salaryType = typeof body.salaryType === "string" ? body.salaryType.trim().toUpperCase() : "";
    const salaryCurrency =
      typeof body.salaryCurrency === "string" ? body.salaryCurrency.trim().toUpperCase() : "";

    const salaryCompleteOnly =
      body.salaryCompleteOnly === true ||
      body.salaryCompleteOnly === "true" ||
      body.salaryCompleteOnly === 1;

    const where: Prisma.EmployeeWhereInput = {};
    const typeFilter = parseSalaryTypeInput(salaryType || undefined);
    if (typeFilter) where.salaryType = typeFilter;
    if (salaryCurrency) where.salaryCurrency = salaryCurrency;
    if (salaryCompleteOnly) {
      where.AND = [
        { salaryType: { not: null } },
        { salaryAmount: { not: null } },
      ];
    }

    const appSettings = await getAppSettings();
    const employees = await prisma.employee.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        firstName: true,
        lastName: true,
        cnp: true,
        iban: true,
        bankName: true,
        salaryType: true,
        salaryAmount: true,
        salaryCurrency: true,
        salaryStartDate: true,
        status: true,
      },
    });

    const headers = [
      "Nume",
      "Prenume",
      "CNP",
      "IBAN",
      "Bancă",
      "Tip plată",
      "Sumă brută",
      "Monedă",
      "Valabil de la",
      "Status",
    ];

    const rows = employees.map((emp) => {
      const tipPlata = emp.salaryType != null ? String(emp.salaryType) : "";
      const sumaVal = salaryAmountToJson(emp.salaryAmount);
      const suma = sumaVal != null ? String(sumaVal) : "";
      const moneda = emp.salaryCurrency?.trim() ?? "";
      return [
        emp.lastName,
        emp.firstName,
        emp.cnp ?? "",
        safeDecrypt(emp.iban),
        emp.bankName ?? "",
        tipPlata,
        suma,
        moneda,
        emp.salaryStartDate ? new Date(emp.salaryStartDate).toLocaleDateString("ro-RO") : "",
        statusLabel(emp.status),
      ];
    });

    logAuditFF({
      action: "EXPORT_EXCEL",
      entity: "Employee",
      userId: user.userId,
      userRole: user.role,
      ipAddress: getClientIp(request),
      newValues: {
        kind: "SALARY_EXPORT",
        format,
        salaryType: salaryType || null,
        salaryCurrency: salaryCurrency || null,
        salaryCompleteOnly,
        count: employees.length,
      },
    });

    if (format === "csv") {
      const meta = [
        `Raport contabilitate - ${appSettings.companyName || "Companie"}`,
        `CUI/Reg. Com.: ${appSettings.companyCuiReg || "-"}`,
        `Generat la: ${new Date().toLocaleString("ro-RO")} (${appSettings.timezone})`,
        "",
      ];
      const lines = [
        ...meta,
        headers.map(csvEscape).join(";"),
        ...rows.map((r) =>
          r
            .map((c, idx) => {
              if (idx === 2 || idx === 3) {
                return csvEscape(`="${String(c)}"`);
              }
              return csvEscape(String(c));
            })
            .join(";")
        ),
      ];
      const csv = "\uFEFF" + lines.join("\r\n");
      const buf = Buffer.from(csv, "utf8");
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="export-salarii-${new Date().toISOString().slice(0, 10)}.csv"`,
          "Content-Length": String(buf.byteLength),
        },
      });
    }

    const aoa = [
      [`Raport contabilitate - ${appSettings.companyName || "Companie"}`],
      [`CUI/Reg. Com.: ${appSettings.companyCuiReg || "-"}`],
      [`Generat la: ${new Date().toLocaleString("ro-RO")} (${appSettings.timezone})`],
      [],
      headers,
      ...rows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 25 },
      { wch: 20 },
      { wch: 14 },
      { wch: 12 },
      { wch: 10 },
      { wch: 14 },
      { wch: 14 },
    ];

    // Force CNP + IBAN as text cells (Excel must not auto-convert).
    for (let rowIndex = 5; rowIndex < aoa.length; rowIndex++) {
      const cnpCell = XLSX.utils.encode_cell({ r: rowIndex, c: 2 });
      const ibanCell = XLSX.utils.encode_cell({ r: rowIndex, c: 3 });
      if (ws[cnpCell]) ws[cnpCell].t = "s";
      if (ws[ibanCell]) ws[ibanCell].t = "s";
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Salarii");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="export-salarii-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        "Content-Length": String(buf.byteLength),
      },
    });
  } catch (error) {
    console.error("[EXPORT_SALARY_SHEET]", error);
    return NextResponse.json({ error: "Eroare la export salarii" }, { status: 500 });
  }
}
