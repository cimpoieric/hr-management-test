import { generatePayslipFromTimesheet } from "@/lib/payslipFromTimesheet";
import { checkPlan, FEATURES } from "@/lib/middleware/plan-check";
import { ROLES_PAYROLL } from "@/lib/roles";
import { prismaTyped as prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  employeeId: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().min(2024).max(2030).optional(),
  weekNumber: z.coerce.number().int().min(0).max(52).optional(),
  type: z.enum(["weekly", "monthly"]).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  monthYear: z.coerce.number().int().min(2024).max(2030).optional(),
  emailSent: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

const generateBodySchema = z.object({
  timesheetId: z.coerce.number().int().positive(),
});

export async function GET(request: NextRequest) {
  const planCheck = await checkPlan(request, FEATURES.PAYROLL_SLIPS, {
    roles: ROLES_PAYROLL,
  });
  if (!planCheck.allowed) return planCheck.response;

  try {
    const { searchParams } = request.nextUrl;

    const page = Math.max(
      1,
      Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
    );
    const pageSize = Math.min(
      200,
      Number.parseInt(searchParams.get("pageSize") ?? "50", 10) || 50,
    );

    const parsed = querySchema.safeParse({
      page,
      pageSize,
      employeeId: searchParams.get("employeeId") ?? undefined,
      year: searchParams.get("year") ?? undefined,
      weekNumber: searchParams.get("weekNumber") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      month: searchParams.get("month") ?? undefined,
      monthYear: searchParams.get("monthYear") ?? undefined,
      emailSent: searchParams.get("emailSent") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parametri query invalizi" },
        { status: 400 },
      );
    }

    const { employeeId, year, weekNumber, type, month, monthYear, emailSent } =
      parsed.data;

    const where: Prisma.PayslipWhereInput = {
      employeeId,
      year,
      weekNumber,
      type,
      month,
      monthYear,
      emailSent: emailSent === undefined ? undefined : emailSent,
    };

    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      prisma.payslip.findMany({
        where,
        orderBy: [{ year: "desc" }, { weekNumber: "desc" }, { id: "desc" }],
        skip,
        take: pageSize,
        include: {
          employee: {
            select: { firstName: true, lastName: true, email: true },
          },
          timesheet: { select: { hoursWorked: true, status: true } },
          items: {
            select: { type: true, amount: true, sortOrder: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      }),
      prisma.payslip.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return NextResponse.json({
      items,
      pagination: { page, pageSize, total, totalPages },
    });
  } catch (error) {
    console.error("[PAYSLIPS_GET]", error);
    return NextResponse.json(
      { error: "Eroare la listarea fluturașilor" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/payroll — generează fluturaș dintr-un pontaj APPROVED
 * Body: { timesheetId }
 */
export async function POST(request: NextRequest) {
  const planCheck = await checkPlan(request, FEATURES.PAYROLL_SLIPS, {
    roles: ROLES_PAYROLL,
  });
  if (!planCheck.allowed) return planCheck.response;

  try {
    const body = await request.json().catch(() => null);
    const parsed = generateBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Body invalid" }, { status: 400 });
    }

    const { timesheetId } = parsed.data;
    const result = await generatePayslipFromTimesheet(timesheetId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { user } = planCheck;
    void logAudit({
      userId: user.userId,
      userEmail: user.email,
      action: "GENERATE_PAYROLL",
      resource: "Payroll",
      resourceId: result.payslip?.id ?? timesheetId,
      details: { timesheetId },
      req: request,
    });
    return NextResponse.json(result.payslip, { status: result.status });
  } catch (error) {
    console.error("[PAYSLIPS_POST]", error);
    return NextResponse.json(
      { error: "Eroare la generarea fluturașului" },
      { status: 500 },
    );
  }
}
