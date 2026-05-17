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
    const payslipId = Number.parseInt(id, 10);
    if (isNaN(payslipId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const payslip = await prisma.payslip.findUnique({
      where: { id: payslipId },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, position: true },
        },
        company: { select: { id: true, name: true, address: true } },
        timesheet: {
          select: {
            id: true,
            hoursWorked: true,
            standardHours: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        items: { orderBy: { sortOrder: "asc" } },
        emailLog: true,
      },
    });

    if (!payslip) {
      return NextResponse.json(
        { error: "Fluturaș inexistent" },
        { status: 404 },
      );
    }

    return NextResponse.json(payslip);
  } catch (error) {
    console.error("[PAYSLIP_GET]", error);
    return NextResponse.json(
      { error: "Eroare la citirea fluturașului" },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
    const payslipId = Number.parseInt(id, 10);
    if (isNaN(payslipId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const existing = await prisma.payslip.findUnique({
      where: { id: payslipId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Fluturaș inexistent" },
        { status: 404 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.payslipItem.deleteMany({ where: { payslipId } });
      await tx.payslip.delete({ where: { id: payslipId } });
    });

    const { logAuditForUser } = await import("@/lib/auditInsert");
    logAuditForUser(user, request, {
      action: "PAYSLIP_DELETED",
      resource: "Payslip",
      resourceId: payslipId,
      newValues: JSON.stringify({ deleted: true, id: payslipId }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PAYSLIP_DELETE]", error);
    return NextResponse.json(
      { error: "Eroare la ștergerea fluturașului" },
      { status: 500 },
    );
  }
}
