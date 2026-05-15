import { requireRole } from "@/lib/auth";
import {
  buildPeriodKey,
  currentPeriodDefaults,
  normalizePaymentFrequency,
  periodRange,
  type PeriodType,
} from "@/lib/paymentPeriod";
import { prismaTyped as prisma } from "@/lib/prisma";
import { ROLES_EMPLOYEES_RW } from "@/lib/roles";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  type: z.enum(["weekly", "monthly"]).optional(),
  year: z.coerce.number().int().min(2024).max(2030).optional(),
  weekNumber: z.coerce.number().int().min(1).max(52).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  monthYear: z.coerce.number().int().min(2024).max(2030).optional(),
  employeeIds: z.array(z.coerce.number().int().positive()).optional(),
});

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_EMPLOYEES_RW,
  );
  if (authError || !user) return authError!;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Body invalid" }, { status: 400 });
    }

    const requestedType = parsed.data.type;
    const employees = await prisma.employee.findMany({
      where: {
        status: "ACTIVE",
        ...(parsed.data.employeeIds?.length
          ? { id: { in: parsed.data.employeeIds } }
          : {}),
      },
      select: {
        id: true,
        organizationId: true,
        paymentFrequency: true,
      },
    });

    const created: number[] = [];
    const skipped: number[] = [];

    for (const emp of employees) {
      const freq: PeriodType = requestedType
        ? requestedType
        : normalizePaymentFrequency(emp.paymentFrequency);

      const defaults = currentPeriodDefaults(freq);
      const year = parsed.data.year ?? defaults.year;
      const weekNumber = parsed.data.weekNumber ?? defaults.weekNumber;
      const month = parsed.data.month ?? defaults.month;
      const monthYear = parsed.data.monthYear ?? defaults.monthYear;

      const periodKey = buildPeriodKey(freq, {
        year,
        weekNumber,
        month,
        monthYear,
      });

      const exists = await prisma.timesheet.findUnique({
        where: {
          employeeId_periodKey: { employeeId: emp.id, periodKey },
        },
        select: { id: true },
      });
      if (exists) {
        skipped.push(emp.id);
        continue;
      }

      const range = periodRange(freq, {
        year,
        weekNumber,
        month,
        monthYear,
      });

      const row = await prisma.timesheet.create({
        data: {
          organizationId: emp.organizationId,
          employeeId: emp.id,
          type: freq,
          periodKey,
          weekNumber: freq === "weekly" ? weekNumber : 0,
          year: freq === "monthly" ? monthYear : year,
          month: freq === "monthly" ? month : null,
          monthYear: freq === "monthly" ? monthYear : null,
          startDate: range.start,
          endDate: range.end,
          hoursWorked: freq === "monthly" ? 168 : 40,
          standardHours: freq === "monthly" ? 168 : 40,
          travelAllowance: 0,
          status: "DRAFT",
        },
      });
      created.push(row.id);
    }

    return NextResponse.json({
      createdCount: created.length,
      skippedCount: skipped.length,
      createdIds: created,
      skippedEmployeeIds: skipped,
    });
  } catch (error) {
    console.error("[TIMESHEETS_AUTO_CREATE]", error);
    return NextResponse.json(
      { error: "Eroare la generarea automat? a pontajelor" },
      { status: 500 },
    );
  }
}
