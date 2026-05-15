/**
 * POST /api/export/weekly-pay — Excel plată bancară (SEPA / operațiuni bancare)
 *
 * Body: { employeeIds: number[], unitsByEmployeeId?: Record<string, number | string> }
 * Compat: hoursByEmployeeId (interpretat ca unități)
 *
 * Total (coloana „suma”): aceeași formulă ca „Total calculat” din UI Plată
 * (ORA / SAPTAMANAL / LUNAR + unități din body).
 */

import { getAppSettings } from "@/lib/appSettings";
import { logAuditFF } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { decrypt } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import {
  computeWeeklyPayTotal,
  parseWeeklyPayUnitsFromRequest,
  salaryAmountToJson,
  weeklyPaySalaryDataComplete,
} from "@/lib/salaryFields";
import { type NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

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

function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** IBAN minim pentru export (fără spații, alfanumeric RO…). */
function isCompleteIbanForBank(s: string): boolean {
  const v = normalizeIban(s);
  return v.length >= 15 && /^[A-Z0-9]+$/.test(v);
}

const BANK_HEADERS = [
  "cont ordonator",
  "cont beneficiar",
  "nume beneficiar 1",
  "suma",
  "detalii plata",
  "instruc\u021biuni",
] as const;

const DETALII_PLATA_FIX = "cv sal ang detasat";
const INSTRUCTIUNI_FIX = "SVD";

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_SETTINGS_ADMIN,
  );
  if (authError || !user) {
    return (
      authError ??
      NextResponse.json({ error: "Neautentificat" }, { status: 401 })
    );
  }

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
        iban: true,
        salaryType: true,
        salaryAmount: true,
        salaryCurrency: true,
      },
    });

    const orderMap = new Map(employeeIds.map((id, i) => [id, i]));
    employees.sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
    );

    const appSettings = await getAppSettings(user.organizationId);
    const contOrdonator = normalizeIban(appSettings.companyIban ?? "");

    let skippedIncomplete = 0;
    let skippedNoIban = 0;
    let skippedZeroTotal = 0;

    const rows: (string | number)[][] = [];

    for (const emp of employees) {
      if (!weeklyPaySalaryDataComplete(emp)) {
        skippedIncomplete++;
        continue;
      }

      const ibanDecrypted = safeDecrypt(emp.iban);
      const contBeneficiar = normalizeIban(ibanDecrypted);
      if (!isCompleteIbanForBank(contBeneficiar)) {
        skippedNoIban++;
        continue;
      }

      const raw = rawUnits[String(emp.id)];
      const units = parseWeeklyPayUnitsFromRequest(raw, emp.salaryType);
      const basis = salaryAmountToJson(emp.salaryAmount);
      const total =
        basis != null
          ? computeWeeklyPayTotal(emp.salaryType, units, emp.salaryAmount)
          : null;

      if (total == null || total <= 0) {
        skippedZeroTotal++;
        continue;
      }

      const sumaStr = total.toFixed(2);
      const numeComplet =
        `${String(emp.lastName ?? "").trim()} ${String(emp.firstName ?? "").trim()}`.trim();

      rows.push([
        contOrdonator,
        contBeneficiar,
        numeComplet,
        sumaStr,
        DETALII_PLATA_FIX,
        INSTRUCTIUNI_FIX,
      ]);
    }

    const skippedTotal = skippedIncomplete + skippedNoIban + skippedZeroTotal;

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: "Niciun rand valid pentru export bancar",
          details: {
            missingIban: skippedNoIban,
            zeroTotal: skippedZeroTotal,
            incompleteSalary: skippedIncomplete,
          },
        },
        { status: 400 },
      );
    }

    const aoa: (string | number)[][] = [[...BANK_HEADERS], ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 28 },
      { wch: 28 },
      { wch: 32 },
      { wch: 14 },
      { wch: 28 },
      { wch: 12 },
    ];

    for (let r = 1; r < aoa.length; r++) {
      for (const c of [0, 1]) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell) cell.t = "s";
      }
      const sumaAddr = XLSX.utils.encode_cell({ r, c: 3 });
      const sumaCell = ws[sumaAddr];
      if (sumaCell) sumaCell.t = "s";
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plata");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const summaryParts: string[] = [];
    if (skippedNoIban > 0)
      summaryParts.push(`${skippedNoIban} fara IBAN valid`);
    if (skippedZeroTotal > 0)
      summaryParts.push(`${skippedZeroTotal} cu total 0`);
    if (skippedIncomplete > 0)
      summaryParts.push(`${skippedIncomplete} date salariale incomplete`);
    const summaryLatin =
      summaryParts.length > 0
        ? `Exclus din export: ${summaryParts.join(", ")}.`
        : "";

    logAuditFF({
      action: "EXPORT_EXCEL",
      entity: "Employee",
      userId: user.userId,
      userRole: user.role,
      ipAddress: getClientIp(request),
      newValues: {
        kind: "WEEKLY_PAY_BANK_XLSX",
        employeeCount: rows.length,
        skippedTotal,
      },
    });

    const filename = `fisa-plata-banca-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.byteLength),
        ...(skippedTotal > 0
          ? {
              "X-Export-Skipped-Count": String(skippedTotal),
              "X-Export-Skipped-Summary": summaryLatin.slice(0, 500),
            }
          : {}),
      },
    });
  } catch (error) {
    console.error("[EXPORT_WEEKLY_PAY]", error);
    return NextResponse.json(
      { error: "Eroare la generare Excel" },
      { status: 500 },
    );
  }
}
