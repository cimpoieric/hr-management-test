import { getAppSettings } from "@/lib/appSettings";
import { logAuditFF } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { decrypt } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import { parseSalaryTypeInput, salaryAmountToJson } from "@/lib/salaryFields";
import type { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

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

/** Normalize IBAN: uppercase, fără spații. */
function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

function parseEmployeeIds(body: unknown): number[] | null {
  const raw = (body as { employeeIds?: unknown }).employeeIds;
  if (!Array.isArray(raw)) return null;
  const ids = raw
    .map((x) => Number.parseInt(String(x), 10))
    .filter((n) => !Number.isNaN(n) && n > 0);
  if (ids.length === 0) return null;
  return [...new Set(ids)].slice(0, 500);
}

function formatNetAmount(net: Prisma.Decimal | null | undefined): string {
  if (net == null) return "";
  const n = Number(net);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2);
}

/** Detalii plată: dinamic după tip salarizare; fallback text fix cerut. */
function detaliiPlata(salaryType: string | null | undefined): string {
  const t = salaryType?.trim().toUpperCase() ?? "";
  if (t === "LUNAR") return "cv sal ang detasat lunar";
  if (t === "SAPTAMANAL") return "cv sal ang detasat saptamanal";
  if (t === "ORA") return "cv sal ang detasat ora";
  return "cv sal ang detasat";
}

const INSTRUCTIUNI_FIX = "SVD";

const BANK_HEADERS = [
  "cont ordonator",
  "cont beneficiar",
  "nume beneficiar 1",
  "suma",
  "detalii plata",
  "instruc\u021biuni",
] as const;

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
    const formatRaw =
      typeof body.format === "string"
        ? body.format.trim().toLowerCase()
        : "xlsx";
    const format = formatRaw === "csv" ? "csv" : "xlsx";

    const salaryType =
      typeof body.salaryType === "string"
        ? body.salaryType.trim().toUpperCase()
        : "";
    const salaryCurrency =
      typeof body.salaryCurrency === "string"
        ? body.salaryCurrency.trim().toUpperCase()
        : "";

    const salaryCompleteOnly =
      body.salaryCompleteOnly === true ||
      body.salaryCompleteOnly === "true" ||
      body.salaryCompleteOnly === 1;

    const employeeIdsFilter = parseEmployeeIds(body);

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
    if (employeeIdsFilter?.length) {
      where.id = { in: employeeIdsFilter };
    }

    const appSettings = await getAppSettings(user.organizationId);
    const contOrdonator = normalizeIban(appSettings.companyIban ?? "");

    if (format === "xlsx") {
      const employees = await prisma.employee.findMany({
        where,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          iban: true,
          salaryType: true,
          payslips: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { netTotal: true },
          },
        },
      });

      const rows: (string | number)[][] = [];
      for (const emp of employees) {
        const beneficiarIban = normalizeIban(safeDecrypt(emp.iban));
        const numeComplet = `${emp.lastName} ${emp.firstName}`.trim();
        const net = emp.payslips[0]?.netTotal;
        const suma = formatNetAmount(net);
        rows.push([
          contOrdonator,
          beneficiarIban,
          numeComplet,
          suma,
          detaliiPlata(emp.salaryType),
          INSTRUCTIUNI_FIX,
        ]);
      }

      logAuditFF({
        action: "EXPORT_EXCEL",
        entity: "Employee",
        userId: user.userId,
        userRole: user.role,
        ipAddress: getClientIp(request),
        newValues: {
          kind: "BANK_PAYMENT_FISA_XLSX",
          salaryType: salaryType || null,
          salaryCurrency: salaryCurrency || null,
          salaryCompleteOnly,
          employeeIdsFilter: employeeIdsFilter?.length ?? null,
          count: employees.length,
        },
      });

      const aoa: (string | number)[][] = [[...BANK_HEADERS], ...rows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = [
        { wch: 28 },
        { wch: 28 },
        { wch: 32 },
        { wch: 14 },
        { wch: 36 },
        { wch: 12 },
      ];

      // IBAN ca text (coloane 0 și 1)
      for (let r = 1; r < aoa.length; r++) {
        for (const c of [0, 1]) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = ws[addr];
          if (cell) cell.t = "s";
        }
        const sumaAddr = XLSX.utils.encode_cell({ r, c: 3 });
        const sumaCell = ws[sumaAddr];
        if (sumaCell && typeof sumaCell.v === "string" && sumaCell.v !== "") {
          sumaCell.t = "s";
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Plata");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="fisa-plata-banca-${new Date().toISOString().slice(0, 10)}.xlsx"`,
          "Content-Length": String(buf.byteLength),
        },
      });
    }

    // ─── CSV: raport contabilitate (format vechi, neschimbat) ───
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
        emp.salaryStartDate
          ? new Date(emp.salaryStartDate).toLocaleDateString("ro-RO")
          : "",
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
        kind: "SALARY_EXPORT_CSV",
        salaryType: salaryType || null,
        salaryCurrency: salaryCurrency || null,
        salaryCompleteOnly,
        employeeIdsFilter: employeeIdsFilter?.length ?? null,
        count: employees.length,
      },
    });

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
          .join(";"),
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
  } catch (error) {
    console.error("[EXPORT_SALARY_SHEET]", error);
    return NextResponse.json(
      { error: "Eroare la export salarii" },
      { status: 500 },
    );
  }
}
