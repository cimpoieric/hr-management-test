import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prismaTyped as prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

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
  request: NextRequest
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
  travelAllowanceEmployeePrefix: "travel_allowance.employee.",
} as const;

function parseDecimalSafe(raw: string | null | undefined, fallback: Prisma.Decimal): Prisma.Decimal {
  if (!raw) return fallback;
  const n = Number(raw);
  if (Number.isNaN(n)) return fallback;
  return new Prisma.Decimal(n);
}

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request, [
    "ADMIN",
    "OPERATOR",
    "ACCOUNTING",
  ]);
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
      return NextResponse.json({ error: "Pontajul trebuie să fie APPROVED" }, { status: 400 });
    }

    const existingPayslip = await prisma.payslip.findUnique({
      where: { timesheetId },
      select: { id: true },
    });
    if (existingPayslip) {
      return NextResponse.json({ error: "Există deja fluturaș pentru acest pontaj" }, { status: 400 });
    }

    if (!timesheet.employee.salaryType || timesheet.employee.salaryAmount === null) {
      return NextResponse.json({ error: "Angajatul nu are salaryType/salaryAmount setate" }, { status: 400 });
    }

    // SystemConfig: holiday money rate + travel allowance per employee
    const [holidayCfg, travelCfg] = await Promise.all([
      prisma.systemConfig.findUnique({ where: { key: SYS_KEYS.holidayMoneyRate } }),
      prisma.systemConfig.findUnique({
        where: { key: `${SYS_KEYS.travelAllowanceEmployeePrefix}${timesheet.employeeId}` },
      }),
    ]);

    const hoursWorked = new Prisma.Decimal(timesheet.hoursWorked);
    const standardHours = new Prisma.Decimal(timesheet.standardHours);
    const salaryAmount = new Prisma.Decimal(timesheet.employee.salaryAmount);

    const holidayRate = parseDecimalSafe(holidayCfg?.value, new Prisma.Decimal(0.4));
    const travelAllowance = parseDecimalSafe(travelCfg?.value, new Prisma.Decimal(0));

    let netSalary: Prisma.Decimal;
    let netSalaryRate: Prisma.Decimal | null = null;

    if (timesheet.employee.salaryType === "ORA") {
      netSalary = hoursWorked.mul(salaryAmount);
      netSalaryRate = salaryAmount;
    } else if (timesheet.employee.salaryType === "SAPTAMANAL") {
      if (standardHours.lte(0)) {
        return NextResponse.json({ error: "standardHours invalid pe pontaj" }, { status: 400 });
      }
      netSalary = hoursWorked.div(standardHours).mul(salaryAmount);
      netSalaryRate = salaryAmount.div(standardHours);
    } else {
      return NextResponse.json(
        { error: "SalaryType neimplementat pentru generarea fluturașului" },
        { status: 400 }
      );
    }

    const holidayMoney = hoursWorked.mul(holidayRate);
    const totalPaid = netSalary.add(holidayMoney).add(travelAllowance);

    const currency = (timesheet.employee.salaryCurrency || "EUR").toUpperCase();

    const created = await prisma.$transaction(async (tx) => {
      const payslip = await tx.payslip.create({
        data: {
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
      });

      const items = await tx.payslipItem.createMany({
        data: [
          {
            payslipId: payslip.id,
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
            payslipId: payslip.id,
            type: "HOLIDAY_MONEY",
            label: "Bani concediu",
            description: `Rate: ${holidayRate.toString()} / oră`,
            amount: holidayMoney,
            quantity: hoursWorked,
            rate: holidayRate,
            sortOrder: 20,
          },
          {
            payslipId: payslip.id,
            type: "TRAVEL_ALLOWANCE",
            label: "Diurnă / transport",
            description: "Configurat din SystemConfig (per angajat) sau 0",
            amount: travelAllowance,
            quantity: null,
            rate: null,
            sortOrder: 30,
          },
        ],
      });

      return { payslipId: payslip.id, itemsCount: items.count };
    });

    const full = await prisma.payslip.findUnique({
      where: { id: created.payslipId },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        timesheet: { select: { id: true, hoursWorked: true, standardHours: true, status: true } },
        items: { orderBy: { sortOrder: "asc" } },
      },
    });

    await logAudit("CREATE", "Payslip", created.payslipId, full, request);

    return NextResponse.json(full, { status: 201 });
  } catch (error) {
    console.error("[PAYSLIPS_GENERATE_POST]", error);
    return NextResponse.json({ error: "Eroare la generarea fluturașului" }, { status: 500 });
  }
}

