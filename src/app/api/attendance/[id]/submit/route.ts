import { requireAuth } from "@/lib/auth";
import { logAuditForUser } from "@/lib/auditInsert";
import { prismaTyped as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(
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

    const existing = await prisma.timesheet.findUnique({
      where: { id: timesheetId },
      select: { id: true, status: true, submittedAt: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Pontaj inexistent" }, { status: 404 });
    }

    if (!["DRAFT", "REJECTED"].includes(existing.status)) {
      return NextResponse.json(
        { error: "Pontajul nu poate fi trimis în statusul curent" },
        { status: 400 },
      );
    }

    const updated = await prisma.timesheet.update({
      where: { id: timesheetId },
      data: { status: "SUBMITTED", submittedAt: new Date() },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, position: true },
        },
      },
    });

    logAuditForUser(user, request, {
      action: "TIMESHEET_UPDATED",
      resource: "Timesheet",
      resourceId: timesheetId,
      oldValues: JSON.stringify(existing),
      newValues: JSON.stringify({ ...updated, event: "SUBMITTED" }),
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[TIMESHEET_SUBMIT_POST]", error);
    return NextResponse.json(
      { error: "Eroare la trimiterea pontajului" },
      { status: 500 },
    );
  }
}
