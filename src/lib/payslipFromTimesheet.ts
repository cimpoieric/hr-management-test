import { prismaTyped as prisma } from "@/lib/prisma";
import {
  calcMonthlyPayslip,
  calcWeeklyPayslip,
  resolvePayslipType,
} from "@/lib/payrollCalc";
import { Prisma } from "@prisma/client";

const SYS_KEYS = { holidayMoneyRate: "holiday_money.rate" } as const;

function parseDecimalSafe(
  raw: string | null | undefined,
  fallback: Prisma.Decimal,
): Prisma.Decimal {
  if (!raw) return fallback;
  const n = Number(raw);
  if (Number.isNaN(n)) return fallback;
  return new Prisma.Decimal(n);
}

export type GeneratePayslipResult = Awaited<
  ReturnType<typeof generatePayslipFromTimesheet>
>;

export async function generatePayslipFromTimesheet(timesheetId: number) {
  const timesheet = await prisma.timesheet.findUnique({
    where: { id: timesheetId },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          position: true,
          salaryType: true,
          salaryAmount: true,
          salaryCurrency: true,
          companyId: true,
          paymentFrequency: true,
        },
      },
    },
  });

  if (!timesheet) {
    return { error: "Pontaj inexistent", status: 404 as const };
  }
  if (timesheet.status !== "APPROVED") {
    return {
      error: "Pontajul trebuie sa fie APPROVED",
      status: 400 as const,
    };
  }
  if (
    timesheet.employee.salaryAmount === null ||
    timesheet.employee.salaryAmount === undefined
  ) {
    return {
      error: "Angajatul nu are salariu configurat in profil",
      status: 400 as const,
    };
  }

  const payslipType = resolvePayslipType(
    timesheet.type,
    timesheet.employee.paymentFrequency,
  );
  const travelAllowance = new Prisma.Decimal(
    Number(timesheet.travelAllowance ?? 0),
  );
  const currency = (
    timesheet.employee.salaryCurrency || "EUR"
  ).toUpperCase();

  let calc;
  if (payslipType === "monthly") {
    const gross = new Prisma.Decimal(timesheet.employee.salaryAmount);
    calc = calcMonthlyPayslip({ grossSalary: gross, travelAllowance });
  } else {
    if (timesheet.employee.salaryType !== "ORA") {
      return {
        error: "Pontaj saptamanal: angajatul trebuie sa aiba salaryType = ORA",
        status: 400 as const,
      };
    }
    const holidayCfg = await prisma.systemConfig.findUnique({
      where: { key: SYS_KEYS.holidayMoneyRate },
    });
    const holidayRate = parseDecimalSafe(
      holidayCfg?.value,
      new Prisma.Decimal(0.4),
    );
    calc = calcWeeklyPayslip({
      hoursWorked: new Prisma.Decimal(timesheet.hoursWorked),
      hourlyRate: new Prisma.Decimal(timesheet.employee.salaryAmount),
      travelAllowance,
      holidayRate,
    });
  }

  const existing = await prisma.payslip.findUnique({
    where: { timesheetId },
    select: { id: true },
  });

  const payslipId = await prisma.$transaction(async (tx) => {
    const baseData = {
      organizationId: timesheet.organizationId,
      timesheetId: timesheet.id,
      employeeId: timesheet.employeeId,
      companyId: timesheet.employee.companyId,
      type: payslipType,
      weekNumber: timesheet.weekNumber,
      year: timesheet.year,
      month: timesheet.month,
      monthYear: timesheet.monthYear,
      periodStart: timesheet.startDate,
      periodEnd: timesheet.endDate,
      currency,
      grossTotal: calc.grossTotal,
      deductionsTotal: calc.deductionsTotal,
      netTotal: calc.netTotal,
      totalPaid: calc.totalPaid,
    };

    const id =
      existing?.id ??
      (await tx.payslip.create({ data: baseData, select: { id: true } })).id;

    if (existing?.id) {
      await tx.payslip.update({ where: { id }, data: baseData });
      await tx.payslipItem.deleteMany({ where: { payslipId: id } });
    }

    await tx.payslipItem.createMany({
      data: calc.items.map((item) => ({
        payslipId: id,
        type: item.type,
        label: item.label,
        description: item.description ?? null,
        amount: item.amount,
        quantity: item.quantity ?? null,
        rate: item.rate ?? null,
        sortOrder: item.sortOrder,
      })),
    });

    return id;
  });

  const full = await prisma.payslip.findUnique({
    where: { id: payslipId },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          position: true,
        },
      },
      company: { select: { id: true, name: true, address: true } },
      timesheet: {
        select: {
          id: true,
          type: true,
          hoursWorked: true,
          standardHours: true,
          status: true,
          month: true,
          monthYear: true,
        },
      },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  return { payslip: full, status: 201 as const };
}
