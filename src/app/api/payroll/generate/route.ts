import { requireRole } from "@/lib/auth";
import { ROLES_PAYROLL } from "@/lib/roles";
import { prismaTyped as prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

async function logAudit(
  action: "CREATE",
  entity: "Payslip",
  entityId: number | null,
  newValues: unknown,
  request: NextRequest,
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        newValues: JSON.stringify(newValues),
        ipAddress: getClientIp(request),
      },
    });
  } catch (e) {
    console.error("[AUDIT_LOG_PAYSLIP_GENERATE]", e);
  }
}

const bodySchema = z.object({
  timesheetId: z.coerce.number().int().positive(),
});

const SYS_KEYS = {
  holidayMoneyRate: "holiday_money.rate",
} as const;

function parseDecimalSafe(
  raw: string | null | undefined,
  fallback: Prisma.Decimal,
): Prisma.Decimal {
  if (!raw) return fallback;
  const n = Number(raw);
  if (Number.isNaN(n)) return fallback;
  return new Prisma.Decimal(n);
}

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_PAYROLL,
  );
  if (authError || !user) return authError!;

  try {
    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Body invalid" }, { status: 400 });
    }

    const { timesheetId } = parsed.data;

    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            salaryType: true,
            salaryAmount: true,
            salaryCurrency: true,
            companyId: true,
            company: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!timesheet) {
      return NextResponse.json({ error: "Pontaj inexistent" }, { status: 404 });
    }

    if (timesheet.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Pontajul trebuie să fie APPROVED" },
        { status: 400 },
      );
    }

    // Dacă există deja payslip (ex: creat anterior ca "schelet" cu totaluri 0),
    // îl regenerăm: recalculăm totaluri și rescriem itemele.
    const existingPayslip = await prisma.payslip.findUnique({
      where: { timesheetId },
      select: { id: true },
    });

    if (
      timesheet.employee.salaryAmount === null ||
      timesheet.employee.salaryAmount === undefined
    ) {
      return NextResponse.json(
        { error: "Angajatul nu are tarif orar configurat în profil" },
        { status: 400 },
      );
    }

    if (timesheet.employee.salaryType !== "ORA") {
      return NextResponse.json(
        { error: "Angajatul trebuie să aibă salaryType = ORA" },
        { status: 400 },
      );
    }

    const holidayCfg = await prisma.systemConfig.findUnique({
      where: { key: SYS_KEYS.holidayMoneyRate },
    });

    const hoursWorked = new Prisma.Decimal(timesheet.hoursWorked);
    const salaryAmount = new Prisma.Decimal(timesheet.employee.salaryAmount);

    const holidayRate = parseDecimalSafe(
      holidayCfg?.value,
      new Prisma.Decimal(0.4),
    );
    const travelAllowance = new Prisma.Decimal(
      Number(timesheet.travelAllowance ?? 0),
    );

    const netSalary = hoursWorked.mul(salaryAmount);
    const netSalaryRate: Prisma.Decimal = salaryAmount;

    const holidayMoney = hoursWorked.mul(holidayRate);
    const totalPaid = netSalary.add(holidayMoney).add(travelAllowance);

    const currency = (timesheet.employee.salaryCurrency || "EUR").toUpperCase();

    const created = await prisma.$transaction(async (tx) => {
      const payslipId =
        existingPayslip?.id ??
        (
          await tx.payslip.create({
            data: {
              organizationId: timesheet.organizationId,
              timesheetId: timesheet.id,
              employeeId: timesheet.employeeId,
              companyId: timesheet.employee.companyId,
              weekNumber: timesheet.weekNumber,
              year: timesheet.year,
              periodStart: timesheet.startDate,
              periodEnd: timesheet.endDate,
              currency,
              grossTotal: totalPaid,
              deductionsTotal: 0,
              netTotal: totalPaid,
              totalPaid,
            },
            select: { id: true },
          })
        ).id;

      if (existingPayslip?.id) {
        await tx.payslip.update({
          where: { id: payslipId },
          data: {
            employeeId: timesheet.employeeId,
            companyId: timesheet.employee.companyId,
            weekNumber: timesheet.weekNumber,
            year: timesheet.year,
            periodStart: timesheet.startDate,
            periodEnd: timesheet.endDate,
            currency,
            grossTotal: totalPaid,
            deductionsTotal: 0,
            netTotal: totalPaid,
            totalPaid,
          },
          select: { id: true },
        });
        await tx.payslipItem.deleteMany({ where: { payslipId } });
      }

      const items = await tx.payslipItem.createMany({
        data: [
          {
            payslipId,
            type: "NET_SALARY",
            label: "Salariu net",
            description:
              timesheet.employee.salaryType === "ORA"
                ? "Tarif orar"
                : "Salariu săptămânal proporțional",
            amount: netSalary,
            quantity: hoursWorked,
            rate: netSalaryRate,
            sortOrder: 10,
          },
          {
            payslipId,
            type: "HOLIDAY_MONEY",
            label: "Bani concediu",
            description: `Rate: ${holidayRate.toString()} / oră`,
            amount: holidayMoney,
            quantity: hoursWorked,
            rate: holidayRate,
            sortOrder: 20,
          },
          {
            payslipId,
            type: "TRAVEL_ALLOWANCE",
            label: "Diurnă / transport",
            description: "Introdus la pontaj (Diurnă / Travel Allowance)",
            amount: travelAllowance,
            quantity: null,
            rate: null,
            sortOrder: 30,
          },
        ],
      });

      return {
        payslipId,
        itemsCount: items.count,
        regenerated: !!existingPayslip?.id,
      };
    });

    const full = await prisma.payslip.findUnique({
      where: { id: created.payslipId },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        timesheet: {
          select: {
            id: true,
            hoursWorked: true,
            standardHours: true,
            status: true,
          },
        },
        items: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!created.regenerated) {
      await logAudit("CREATE", "Payslip", created.payslipId, full, request);
    } else {
      await logAudit(
        "CREATE",
        "Payslip",
        created.payslipId,
        { regenerated: true, payslipId: created.payslipId },
        request,
      );
    }

    // Aliniere: /api/payroll (POST) e endpoint-ul canonic de generare.
    // Păstrăm /api/payroll/generate pentru compatibilitate cu UI existent.
    const canonicalRes = await fetch(new URL("/api/payroll", request.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({ timesheetId }),
    });
    const canonicalJson: unknown = await canonicalRes.json().catch(() => ({}));
    if (!canonicalRes.ok) {
      const errMsg =
        typeof canonicalJson === "object" &&
        canonicalJson !== null &&
        "error" in canonicalJson &&
        typeof (canonicalJson as { error: unknown }).error === "string"
          ? (canonicalJson as { error: string }).error
          : "Eroare la generarea fluturașului";
      return NextResponse.json(
        { error: errMsg },
        { status: canonicalRes.status },
      );
    }
    return NextResponse.json(canonicalJson, { status: 201 });
  } catch (error) {
    console.error("[PAYSLIPS_GENERATE_POST]", error);
    return NextResponse.json(
      { error: "Eroare la generarea fluturașului" },
      { status: 500 },
    );
  }
}
