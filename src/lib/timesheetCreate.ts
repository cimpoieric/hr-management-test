import {
  buildPeriodKey,
  normalizePaymentFrequency,
  periodRange,
  type PeriodType,
} from "@/lib/paymentPeriod";
import { prismaTyped as prisma } from "@/lib/prisma";

export type TimesheetCreateInput = {
  employeeId: number;
  type?: PeriodType;
  weekNumber?: number;
  year?: number;
  month?: number;
  monthYear?: number;
  startDate?: Date;
  endDate?: Date;
  hoursWorked: number;
  standardHours?: number;
  travelAllowance?: number;
  dailyBreakdown?: string;
  notes?: string;
};

export async function createTimesheetRecord(input: TimesheetCreateInput) {
  const emp = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: {
      organizationId: true,
      paymentFrequency: true,
      status: true,
    },
  });
  if (!emp) return { error: "Angajat negasit", status: 404 as const };
  if (emp.status !== "ACTIVE") {
    return { error: "Angajatul nu este activ", status: 400 as const };
  }

  const freq = normalizePaymentFrequency(
    input.type ?? emp.paymentFrequency,
  );
  const year =
    input.year ??
    input.monthYear ??
    new Date().getFullYear();
  const month = input.month ?? new Date().getMonth() + 1;
  const weekNumber =
    freq === "weekly"
      ? Math.min(52, Math.max(1, input.weekNumber ?? 1))
      : 0;

  const range =
    input.startDate && input.endDate
      ? { start: input.startDate, end: input.endDate }
      : periodRange(freq, {
          year,
          weekNumber,
          month,
          monthYear: input.monthYear ?? year,
        });

  const periodKey = buildPeriodKey(freq, {
    year,
    weekNumber,
    month,
    monthYear: input.monthYear ?? year,
  });

  const existing = await prisma.timesheet.findUnique({
    where: { employeeId_periodKey: { employeeId: input.employeeId, periodKey } },
    select: { id: true },
  });
  if (existing) {
    return {
      error:
        freq === "monthly"
          ? "Exista deja un pontaj lunar pentru aceasta perioada"
          : "Exista deja un pontaj pentru aceasta saptamana",
      status: 400 as const,
    };
  }

  const created = await prisma.timesheet.create({
    data: {
      organizationId: emp.organizationId,
      employeeId: input.employeeId,
      type: freq,
      periodKey,
      weekNumber,
      year: freq === "monthly" ? (input.monthYear ?? year) : year,
      month: freq === "monthly" ? month : null,
      monthYear: freq === "monthly" ? (input.monthYear ?? year) : null,
      startDate: range.start,
      endDate: range.end,
      hoursWorked: input.hoursWorked,
      standardHours: input.standardHours ?? (freq === "monthly" ? 168 : 40),
      travelAllowance: input.travelAllowance ?? 0,
      dailyBreakdown: input.dailyBreakdown,
      notes: input.notes,
      status: "DRAFT",
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, position: true },
      },
    },
  });

  return { timesheet: created, status: 201 as const };
}
