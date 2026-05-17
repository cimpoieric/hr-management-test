import { requireAuth, requireRole } from "@/lib/auth";
import { logAuditForUser } from "@/lib/auditInsert";
import { ROLES_EMPLOYEES_RW } from "@/lib/roles";
import { prismaTyped as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(
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
      select: {
        id: true,
        employeeId: true,
        weekNumber: true,
        year: true,
        startDate: true,
        endDate: true,
        status: true,
        notes: true,
        approvedAt: true,
        approvedById: true,
        employee: { select: { companyId: true } },
        payslip: { select: { id: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Pontaj inexistent" }, { status: 404 });
    }

    if (!["SUBMITTED", "DRAFT"].includes(existing.status)) {
      return NextResponse.json(
        { error: "Pontajul nu poate fi aprobat în statusul curent" },
        { status: 400 },
      );
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const updatedTimesheet = await tx.timesheet.update({
        where: { id: timesheetId },
        data: {
          status: "APPROVED",
          approvedAt: now,
          approvedById: user.userId,
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              position: true,
            },
          },
        },
      });

      // IMPORTANT:
      // NU creăm Payslip aici, pentru că generarea totalurilor și itemelor se face în /api/payroll/generate.
      // Dacă am crea aici un payslip "gol" (totaluri 0), UI ar afișa 0.00 până la regenerare.
      return { updatedTimesheet, createdPayslip: null as null };
    });

    logAuditForUser(user, request, {
      action: "TIMESHEET_UPDATED",
      resource: "Timesheet",
      resourceId: result.updatedTimesheet.id,
      oldValues: JSON.stringify(existing),
      newValues: JSON.stringify({ ...result.updatedTimesheet, event: "APPROVED" }),
    });

    return NextResponse.json(result.updatedTimesheet);
  } catch (error) {
    console.error("[TIMESHEET_APPROVE_POST]", error);
    return NextResponse.json(
      { error: "Eroare la aprobarea pontajului" },
      { status: 500 },
    );
  }
}
