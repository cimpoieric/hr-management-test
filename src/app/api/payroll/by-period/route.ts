import { requireRole } from "@/lib/auth";
import { buildPeriodKey } from "@/lib/paymentPeriod";
import { ROLES_PAYROLL } from "@/lib/roles";
import { prismaTyped as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  type: z.enum(["weekly", "monthly"]).default("weekly"),
  year: z.coerce.number().int().min(2024).max(2030),
  weekNumber: z.coerce.number().int().min(1).max(52).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  monthYear: z.coerce.number().int().min(2024).max(2030).optional(),
});

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_PAYROLL,
  );
  if (authError || !user) return authError!;

  try {
    const sp = request.nextUrl.searchParams;
    const parsed = querySchema.safeParse({
      type: sp.get("type") ?? "weekly",
      year: sp.get("year"),
      weekNumber: sp.get("weekNumber") ?? undefined,
      month: sp.get("month") ?? undefined,
      monthYear: sp.get("monthYear") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parametri query invalizi" },
        { status: 400 },
      );
    }

    const { type, year, weekNumber, month, monthYear } = parsed.data;
    if (type === "weekly" && !weekNumber) {
      return NextResponse.json(
        { error: "weekNumber este obligatoriu pentru tip weekly" },
        { status: 400 },
      );
    }
    if (type === "monthly" && !month) {
      return NextResponse.json(
        { error: "month este obligatoriu pentru tip monthly" },
        { status: 400 },
      );
    }

    const periodKey = buildPeriodKey(type, {
      year,
      weekNumber,
      month,
      monthYear: monthYear ?? year,
    });

    const timesheets = await prisma.timesheet.findMany({
      where: { periodKey },
      select: { id: true },
    });
    const timesheetIds = timesheets.map((t) => t.id);

    const items = await prisma.payslip.findMany({
      where: { timesheetId: { in: timesheetIds } },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
        items: { orderBy: { sortOrder: "asc" } },
        timesheet: {
          select: {
            id: true,
            type: true,
            periodKey: true,
            status: true,
          },
        },
      },
      orderBy: [{ employeeId: "asc" }],
    });

    return NextResponse.json({
      type,
      periodKey,
      year,
      weekNumber: weekNumber ?? null,
      month: month ?? null,
      monthYear: monthYear ?? null,
      items,
    });
  } catch (error) {
    console.error("[PAYROLL_BY_PERIOD]", error);
    return NextResponse.json(
      { error: "Eroare la listarea flutura?ilor pe perioad?" },
      { status: 500 },
    );
  }
}
