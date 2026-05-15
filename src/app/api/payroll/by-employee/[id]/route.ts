import { requireRole } from "@/lib/auth";
import { ROLES_PAYROLL } from "@/lib/roles";
import { prismaTyped as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_PAYROLL,
  );
  if (authError || !user) return authError!;

  try {
    const { id } = await params;
    const employeeId = Number.parseInt(id, 10);
    if (!Number.isFinite(employeeId) || employeeId <= 0) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const items = await prisma.payslip.findMany({
      where: { employeeId },
      orderBy: [
        { year: "desc" },
        { monthYear: "desc" },
        { month: "desc" },
        { weekNumber: "desc" },
        { id: "desc" },
      ],
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        timesheet: {
          select: {
            id: true,
            type: true,
            status: true,
            hoursWorked: true,
            month: true,
            monthYear: true,
          },
        },
        company: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ employeeId, items });
  } catch (error) {
    console.error("[PAYROLL_BY_EMPLOYEE]", error);
    return NextResponse.json(
      { error: "Eroare la listarea flutura?ilor angajatului" },
      { status: 500 },
    );
  }
}
