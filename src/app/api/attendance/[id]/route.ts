import { requireAuth, requireRole } from "@/lib/auth";
import { ROLES_EMPLOYEES_RW } from "@/lib/roles";
import { prismaTyped as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_EMPLOYEES_RW,
  );
  if (authError || !user) return authError!;

  try {
    const { id } = await params;
    const timesheetId = Number.parseInt(id, 10);
    if (isNaN(timesheetId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const existing = await prisma.timesheet.findUnique({
      where: { id: timesheetId },
      select: { id: true, employeeId: true, weekNumber: true, year: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Pontaj inexistent" }, { status: 404 });
    }

    const payslip = await prisma.payslip.findUnique({
      where: { timesheetId },
      select: { id: true },
    });
    if (payslip) {
      return NextResponse.json(
        { error: "Șterge mai întâi fluturașul" },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.timesheet.delete({ where: { id: timesheetId } });
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entity: "Timesheet",
          entityId: timesheetId,
          newValues: JSON.stringify({ deleted: true, ...existing }),
          ipAddress: getClientIp(request),
          userId: user.userId,
          userRole: user.role,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[TIMESHEET_DELETE]", error);
    return NextResponse.json(
      { error: "Eroare la ștergerea pontajului" },
      { status: 500 },
    );
  }
}

const updateSchema = z
  .object({
    employeeId: z.coerce.number().int().positive(),
    weekNumber: z.coerce.number().int().min(1).max(52),
    year: z.coerce.number().int().min(2024).max(2030),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    hoursWorked: z.coerce.number().min(0).max(80),
    standardHours: z.coerce.number().min(0).max(80).optional().default(40),
    travelAllowance: z.coerce
      .number()
      .min(0)
      .max(1_000_000)
      .optional()
      .default(0),
    dailyBreakdown: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((v) => v.startDate < v.endDate, {
    message: "startDate trebuie să fie înainte de endDate",
    path: ["endDate"],
  });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) return authError!;

  try {
    const { id } = await params;
    const timesheetId = Number.parseInt(id, 10);
    if (isNaN(timesheetId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetId },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, position: true },
        },
      },
    });
    if (!timesheet) {
      return NextResponse.json({ error: "Pontaj inexistent" }, { status: 404 });
    }

    return NextResponse.json(timesheet);
  } catch (error) {
    console.error("[TIMESHEET_GET]", error);
    return NextResponse.json(
      { error: "Eroare la citirea pontajului" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_EMPLOYEES_RW,
  );
  if (authError || !user) return authError!;

  try {
    const { id } = await params;
    const timesheetId = Number.parseInt(id, 10);
    if (isNaN(timesheetId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const existing = await prisma.timesheet.findUnique({
      where: { id: timesheetId },
      select: { id: true, status: true, payslip: { select: { id: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Pontaj inexistent" }, { status: 404 });
    }

    if (existing.status === "APPROVED") {
      return NextResponse.json(
        { error: "Pontajul APPROVED nu poate fi editat" },
        { status: 400 },
      );
    }

    if (existing.payslip?.id) {
      return NextResponse.json(
        { error: "Șterge mai întâi fluturașul" },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Body invalid" }, { status: 400 });
    }

    const v = parsed.data;
    const updated = await prisma.timesheet.update({
      where: { id: timesheetId },
      data: {
        employeeId: v.employeeId,
        weekNumber: v.weekNumber,
        year: v.year,
        startDate: v.startDate,
        endDate: v.endDate,
        hoursWorked: v.hoursWorked,
        standardHours: v.standardHours,
        travelAllowance: v.travelAllowance,
        dailyBreakdown: v.dailyBreakdown ?? null,
        notes: v.notes ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "Timesheet",
        entityId: timesheetId,
        newValues: JSON.stringify(updated),
        ipAddress: getClientIp(request),
        userId: user.userId,
        userRole: user.role,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[TIMESHEET_PUT]", error);
    return NextResponse.json(
      { error: "Eroare la actualizarea pontajului" },
      { status: 500 },
    );
  }
}
