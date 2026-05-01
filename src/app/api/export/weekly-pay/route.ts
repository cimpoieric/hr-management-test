/**
 * POST /api/export/weekly-pay — Excel „Plată săptămânală” (angajați ORA + ore lucrate)
 *
 * Body: { employeeIds: number[], hoursByEmployeeId?: Record<string, number> }
 */

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditFF } from "@/lib/audit";
import { getAppSettings } from "@/lib/appSettings";
import { salaryAmountToJson } from "@/lib/salaryFields";
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

function isOraSalaryComplete(emp: {
  salaryType: "LUNAR" | "SAPTAMANAL" | "ORA" | null;
  salaryAmount: Parameters<typeof salaryAmountToJson>[0];
  salaryCurrency: string | null;
}): boolean {
  if (emp.salaryType !== "ORA") return false;
  const rate = salaryAmountToJson(emp.salaryAmount);
  return rate != null && rate > 0 && !!(emp.salaryCurrency?.trim());
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

    const rawHours: Record<string, unknown> =
      body.hoursByEmployeeId && typeof body.hoursByEmployeeId === "object"
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
      "Nume complet",
      "CNP",
      "IBAN",
      "Bancă",
      "Suma brută/oră",
      "Ore lucrate",
      "Total de plată",
      "Monedă",
    ];

    const rows: (string | number)[][] = employees.map((emp) => {
      const nume = `${emp.lastName} ${emp.firstName}`.trim();
      const cnp = emp.cnp ?? "";
      const iban = safeDecrypt(emp.iban);
      const bank = emp.bankName ?? "";
      const currency = (emp.salaryCurrency ?? "").trim().toUpperCase();
      const ready = isOraSalaryComplete(emp);
      const rate = ready ? salaryAmountToJson(emp.salaryAmount) : null;
      const hoursRaw = rawHours[String(emp.id)];
      const hours =
        typeof hoursRaw === "number" && Number.isFinite(hoursRaw)
          ? hoursRaw
          : typeof hoursRaw === "string"
            ? Number(hoursRaw.replace(",", ".")) || 0
            : 0;
      const total = ready && rate != null ? Math.round(hours * rate * 100) / 100 : "";

      return [
        nume,
        cnp,
        iban,
        bank,
        ready && rate != null ? rate : "",
        ready ? hours : "",
        total === "" ? "" : total,
        ready ? currency : "",
      ];
    });

    const metadataRows = [
      [`Plată săptămânală — ${appSettings.companyName || "Companie"}`],
      [`CUI/Reg. Com.: ${appSettings.companyCuiReg || "-"}`],
      [`Generat la: ${new Date().toLocaleString("ro-RO")} (${appSettings.timezone})`],
      [`Doar angajații cu tip plată ORA și date complete au ore și total calculate.`],
      [],
    ];

    const ws = XLSX.utils.aoa_to_sheet([...metadataRows, headers, ...rows]);
    ws["!cols"] = [
      { wch: 26 },
      { wch: 15 },
      { wch: 28 },
      { wch: 18 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 8 },
    ];

    const cnpCol = 1;
    const ibanCol = 2;
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
