import { NextRequest, NextResponse } from "next/server";
import { prismaTyped as prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) return authError!;

  try {
    const { id } = await params;
    const payslipId = parseInt(id, 10);
    if (isNaN(payslipId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const payslip = await prisma.payslip.findUnique({
      where: { id: payslipId },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, position: true } },
        company: { select: { id: true, name: true } },
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
      return NextResponse.json({ error: "Fluturaș inexistent" }, { status: 404 });
    }

    return NextResponse.json(payslip);
  } catch (error) {
    console.error("[PAYSLIP_GET]", error);
    return NextResponse.json({ error: "Eroare la citirea fluturașului" }, { status: 500 });
  }
}

