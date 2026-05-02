/**
 * POST /api/export/weekly-pay — Excel „Plată săptămânală”
 *
 * Body: { employeeIds: number[], unitsByEmployeeId?: Record<string, number | string> }
 * Compat: hoursByEmployeeId (interpretat ca unități)
 *
 * Total: ORA = ore×sumă; SAPTAMANAL = săptămâni×sumă; LUNAR = (zile/21)×sumă (zile goale → 21).
 */

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditFF } from "@/lib/audit";
import { getAppSettings } from "@/lib/appSettings";
import {
  salaryAmountToJson,
  weeklyPaySalaryDataComplete,
  computeWeeklyPayTotal,
  parseWeeklyPayUnitsFromRequest,
} from "@/lib/salaryFields";
import { decrypt } from "@/lib/encryption";

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
        iban: true,
        bankName: true,
        salaryType: true,
        salaryAmount: true,
        salaryCurrency: true,
      },
    });

    const orderMap = new Map(employeeIds.map((id, i) => [id, i]));
    employees.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

    const appSettings = await getAppSettings();
    const headers = [
      "Nume",
      "Prenume",
      "CNP",
      "IBAN",
      "Bancă",
      "Tip plată",
      "Sumă brută",
      "Perioada lucrată",
      "Total de plată",
      "Monedă",
    ];

    const rows: (string | number)[][] = employees.map((emp) => {
      const nume = String(emp.lastName ?? "").trim();
      const prenume = String(emp.firstName ?? "").trim();
      const cnp = emp.cnp ?? "";
      const iban = safeDecrypt(emp.iban);
      const bank = emp.bankName ?? "";
      const currency = (emp.salaryCurrency ?? "").trim();
      const payTypeLabel = String(emp.salaryType ?? "").trim();
      const ready = weeklyPaySalaryDataComplete(emp);
      const basis = ready ? salaryAmountToJson(emp.salaryAmount) : null;
      const raw = rawUnits[String(emp.id)];
      const units = ready ? parseWeeklyPayUnitsFromRequest(raw, emp.salaryType) : 0;
      const total =
        ready && basis != null
          ? computeWeeklyPayTotal(emp.salaryType, units, emp.salaryAmount)
          : null;

      return [
        nume,
        prenume,
        cnp,
        iban,
        bank,
        ready ? payTypeLabel : "",
        ready && basis != null ? basis : "",
        ready ? units : "",
        total != null ? total : "",
        ready ? currency : "",
      ];
    });

    const metadataRows = [
      [`Plată săptămânală — ${appSettings.companyName || "Companie"}`],
      [`CUI/Reg. Com.: ${appSettings.companyCuiReg || "-"}`],
      [`Generat la: ${new Date().toLocaleString("ro-RO")} (${appSettings.timezone})`],
      [
        `Coloana „Perioada lucrată”: ORA = ore; SAPTAMANAL = săptămâni; LUNAR = zile (gol = 21). Total: ORA = ore×sumă; SAPTAMANAL = săptămâni×sumă săpt.; LUNAR = (zile/21)×sumă lunară.`,
      ],
      [],
    ];

    const ws = XLSX.utils.aoa_to_sheet([...metadataRows, headers, ...rows]);
    ws["!cols"] = [
      { wch: 14 },
      { wch: 14 },
      { wch: 15 },
      { wch: 28 },
      { wch: 18 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 8 },
    ];

    const cnpCol = 2;
    const ibanCol = 3;
    const dataStartRow = metadataRows.length + 1;
    for (let rowOffset = 0; rowOffset < rows.length; rowOffset++) {
      const r = dataStartRow + rowOffset;
      for (const c of [cnpCol, ibanCol]) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (ws[ref]) ws[ref].t = "s";
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plata saptamanala");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    logAuditFF({
      action: "EXPORT_EXCEL",
      entity: "Employee",
      userId: user.userId,
      userRole: user.role,
      ipAddress: getClientIp(request),
      newValues: { kind: "WEEKLY_PAY_EXPORT", employeeCount: employees.length },
    });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="plata-saptamanala-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        "Content-Length": String(buf.byteLength),
      },
    });
  } catch (error) {
    console.error("[EXPORT_WEEKLY_PAY]", error);
    return NextResponse.json({ error: "Eroare la generare Excel" }, { status: 500 });
  }
}
