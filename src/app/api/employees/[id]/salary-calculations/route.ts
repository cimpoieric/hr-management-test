import { logAuditFF } from "@/lib/audit";
import { requireAuth, requireRole } from "@/lib/auth";
import { ROLES_EMPLOYEES_RW } from "@/lib/roles";
import { canEditEmployee } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const saveSchema = z.object({
  salaryType: z.enum(["LUNAR", "SAPTAMANAL", "ORA"]),
  salaryAmount: z.number().nonnegative(),
  salaryCurrency: z.string().min(1).max(10),
  inputValue: z.number().nonnegative().nullable().optional(),
  inputLabel: z.string().max(40).nullable().optional(),
  calculatedTotal: z.number().nonnegative(),
});

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

async function getEmployeeId(params: Promise<{ id: string }>): Promise<number> {
  const { id } = await params;
  const parsed = Number.parseInt(id, 10);
  if (Number.isNaN(parsed)) throw new Error("ID invalid");
  return parsed;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return (
      authError ??
      NextResponse.json({ error: "Neautentificat" }, { status: 401 })
    );
  }

  try {
    const employeeId = await getEmployeeId(params);
    const { searchParams } = request.nextUrl;
    const period = (searchParams.get("period") ?? "all").toLowerCase();
    const now = new Date();
    const fromDate =
      period === "today"
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : period === "7d"
          ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          : period === "30d"
            ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            : null;

    const items = await prisma.salaryCalculation.findMany({
      where: {
        employeeId,
        ...(fromDate ? { createdAt: { gte: fromDate } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return NextResponse.json({ data: items });
  } catch (error) {
    console.error("[SALARY_CALCULATIONS_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_EMPLOYEES_RW,
  );
  if (authError || !user) return authError!;
  if (!canEditEmployee(user.role)) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  try {
    const employeeId = await getEmployeeId(params);
    const body = await request.json();
    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const created = await prisma.salaryCalculation.create({
      data: {
        employeeId,
        salaryType: data.salaryType,
        salaryAmount: data.salaryAmount,
        salaryCurrency: data.salaryCurrency.trim().toUpperCase(),
        inputValue: data.inputValue ?? null,
        inputLabel: data.inputLabel ?? null,
        calculatedTotal: data.calculatedTotal,
      },
    });

    logAuditFF({
      action: "CREATE",
      entity: "Employee",
      entityId: employeeId,
      userId: user.userId,
      userRole: user.role,
      ipAddress: getClientIp(request),
      newValues: {
        employeeId,
        salaryType: created.salaryType,
        salaryCurrency: created.salaryCurrency,
        calculatedTotal: created.calculatedTotal,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[SALARY_CALCULATIONS_POST]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
