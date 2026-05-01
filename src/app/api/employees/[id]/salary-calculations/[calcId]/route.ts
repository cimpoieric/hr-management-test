import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canEditEmployee } from "@/lib/permissions";
import { logAuditFF } from "@/lib/audit";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

async function getIds(
  params: Promise<{ id: string; calcId: string }>
): Promise<{ employeeId: number; calculationId: number }> {
  const { id, calcId } = await params;
  const employeeId = parseInt(id, 10);
  const calculationId = parseInt(calcId, 10);
  if (Number.isNaN(employeeId) || Number.isNaN(calculationId)) {
    throw new Error("ID invalid");
  }
  return { employeeId, calculationId };
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; calcId: string }> }
) {
  const { user, response: authError } = await requireAuth(request, ["ADMIN", "OPERATOR"]);
  if (authError || !user) return authError!;
  if (!canEditEmployee(user.role)) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  try {
    const { employeeId, calculationId } = await getIds(params);
    const existing = await prisma.salaryCalculation.findFirst({
      where: { id: calculationId, employeeId },
      select: { id: true, calculatedTotal: true, salaryCurrency: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Calcul negăsit" }, { status: 404 });
    }

    await prisma.salaryCalculation.delete({
      where: { id: calculationId },
    });

    logAuditFF({
      action: "DELETE",
      entity: "Employee",
      entityId: employeeId,
      userId: user.userId,
      userRole: user.role,
      ipAddress: getClientIp(request),
      oldValues: {
        calculationId,
        calculatedTotal: existing.calculatedTotal,
        salaryCurrency: existing.salaryCurrency,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SALARY_CALCULATION_DELETE]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
