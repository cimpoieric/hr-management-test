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

async function logAudit(
  action: "UPDATE",
  entityId: number | null,
  oldValues: unknown | null,
  newValues: unknown | null,
  request: NextRequest,
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity: "Timesheet",
        entityId,
        oldValues: oldValues ? JSON.stringify(oldValues) : null,
        newValues: newValues ? JSON.stringify(newValues) : null,
        ipAddress: getClientIp(request),
      },
    });
  } catch (e) {
    console.error("[AUDIT_LOG_TIMESHEET_REJECT]", e);
  }
}

const rejectSchema = z.object({
  notes: z.string().trim().min(1).max(2000).optional(),
});

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

    const body = await request.json().catch(() => ({}));
    const parsed = rejectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Body invalid" }, { status: 400 });
    }

    const existing = await prisma.timesheet.findUnique({
      where: { id: timesheetId },
      select: { id: true, status: true, notes: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Pontaj inexistent" }, { status: 404 });
    }

    const updated = await prisma.timesheet.update({
      where: { id: timesheetId },
      data: {
        status: "REJECTED",
        notes: parsed.data.notes ?? existing.notes,
        approvedAt: null,
        approvedById: null,
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, position: true },
        },
      },
    });

    await logAudit("UPDATE", updated.id, existing, updated, request);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[TIMESHEET_REJECT_POST]", error);
    return NextResponse.json(
      { error: "Eroare la respingerea pontajului" },
      { status: 500 },
    );
  }
}
