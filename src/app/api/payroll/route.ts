import { requireRole } from "@/lib/auth";
import { ROLES_PAYROLL } from "@/lib/roles";
import { prismaTyped as prisma } from "@/lib/prisma";
import { generatePayslipPdf } from "@/lib/services/payslipPdf";
import { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  employeeId: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().min(2024).max(2030).optional(),
  weekNumber: z.coerce.number().int().min(1).max(52).optional(),
  emailSent: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

const generateBodySchema = z.object({
  timesheetId: z.coerce.number().int().positive(),
});

const SYS_KEYS = {
  holidayMoneyRate: "holiday_money.rate",
} as const;

function parseDecimalSafe(
  raw: string | null | undefined,
  fallback: Prisma.Decimal,
): Prisma.Decimal {
  if (!raw) return fallback;
  const n = Number(raw);
  if (Number.isNaN(n)) return fallback;
  return new Prisma.Decimal(n);
}

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_PAYROLL,
  );
  if (authError || !user) {
    return (
      authError ??
      NextResponse.json({ error: "Neautentificat" }, { status: 401 })
    );
  }

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
      emailSent: searchParams.get("emailSent") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parametri query invalizi" },
        { status: 400 },
      );
    }

    const { employeeId, year, weekNumber, emailSent } = parsed.data;

    const where: Prisma.PayslipWhereInput = {
      employeeId,
      year,
      weekNumber,
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
  const { user, response: authError } = await requireRole(
    request,
    ROLES_PAYROLL,
  );
  if (authError || !user) return authError!;

  try {
    const body = await request.json().catch(() => null);
    const parsed = generateBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Body invalid" }, { status: 400 });
    }

    const { timesheetId } = parsed.data;

    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetId },
      include: {
        employee: {
          select: {
            id: true,
            salaryType: true,
            salaryAmount: true,
            salaryCurrency: true,
            companyId: true,
          },
        },
      },
    });

    if (!timesheet) {
      return NextResponse.json({ error: "Pontaj inexistent" }, { status: 404 });
    }

    if (timesheet.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Pontajul trebuie să fie APPROVED" },
        { status: 400 },
      );
    }

    if (
      timesheet.employee.salaryAmount === null ||
      timesheet.employee.salaryAmount === undefined
    ) {
      return NextResponse.json(
        { error: "Angajatul nu are tarif orar configurat în profil" },
        { status: 400 },
      );
    }

    if (timesheet.employee.salaryType !== "ORA") {
      return NextResponse.json(
        { error: "Angajatul trebuie să aibă salaryType = ORA" },
        { status: 400 },
      );
    }

    const holidayCfg = await prisma.systemConfig.findUnique({
      where: { key: SYS_KEYS.holidayMoneyRate },
    });

    const hoursWorked = new Prisma.Decimal(timesheet.hoursWorked);
    const salaryAmount = new Prisma.Decimal(timesheet.employee.salaryAmount);
    const holidayRate = parseDecimalSafe(
      holidayCfg?.value,
      new Prisma.Decimal(0.4),
    );
    const travelAllowance = new Prisma.Decimal(
      Number(timesheet.travelAllowance ?? 0),
    );

    const netSalary = hoursWorked.mul(salaryAmount);
    const holidayMoney = hoursWorked.mul(holidayRate);
    const totalPaid = netSalary.add(holidayMoney).add(travelAllowance);

    const currency = (timesheet.employee.salaryCurrency || "EUR").toUpperCase();

    const existing = await prisma.payslip.findUnique({
      where: { timesheetId },
      select: { id: true },
    });

    const payslipId = await prisma.$transaction(async (tx) => {
      const id =
        existing?.id ??
        (
          await tx.payslip.create({
            data: {
              organizationId: timesheet.organizationId,
              timesheetId: timesheet.id,
              employeeId: timesheet.employeeId,
              companyId: timesheet.employee.companyId,
              weekNumber: timesheet.weekNumber,
              year: timesheet.year,
              periodStart: timesheet.startDate,
              periodEnd: timesheet.endDate,
              currency,
              grossTotal: totalPaid,
              deductionsTotal: 0,
              netTotal: totalPaid,
              totalPaid,
            },
            select: { id: true },
          })
        ).id;

      if (existing?.id) {
        await tx.payslip.update({
          where: { id },
          data: {
            employeeId: timesheet.employeeId,
            companyId: timesheet.employee.companyId,
            weekNumber: timesheet.weekNumber,
            year: timesheet.year,
            periodStart: timesheet.startDate,
            periodEnd: timesheet.endDate,
            currency,
            grossTotal: totalPaid,
            deductionsTotal: 0,
            netTotal: totalPaid,
            totalPaid,
          },
          select: { id: true },
        });
        await tx.payslipItem.deleteMany({ where: { payslipId: id } });
      }

      await tx.payslipItem.createMany({
        data: [
          {
            payslipId: id,
            type: "NET_SALARY",
            label: "Salariu net",
            description: "Tarif orar",
            amount: netSalary,
            quantity: hoursWorked,
            rate: salaryAmount,
            sortOrder: 10,
          },
          {
            payslipId: id,
            type: "HOLIDAY_MONEY",
            label: "Bani concediu",
            description: `Rate: ${holidayRate.toString()} / oră`,
            amount: holidayMoney,
            quantity: hoursWorked,
            rate: holidayRate,
            sortOrder: 20,
          },
          {
            payslipId: id,
            type: "TRAVEL_ALLOWANCE",
            label: "Diurnă / transport",
            description: "Introdus la pontaj (Diurnă / Travel Allowance)",
            amount: travelAllowance,
            quantity: null,
            rate: null,
            sortOrder: 30,
          },
        ],
      });

      return id;
    });

    // Persist PDF on disk + set pdfPath / pdfGeneratedAt (required by email routes).
    try {
      await generatePayslipPdf(payslipId);
    } catch (pdfErr) {
      console.error("[PAYSLIPS_POST_PDF]", pdfErr);
      return NextResponse.json(
        {
          error:
            "Fluturasul a fost salvat dar generarea PDF a esuat. Reincercati sau deschideti previzualizarea PDF din lista.",
        },
        { status: 500 },
      );
    }

    const full = await prisma.payslip.findUnique({
      where: { id: payslipId },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        timesheet: {
          select: {
            id: true,
            hoursWorked: true,
            standardHours: true,
            status: true,
          },
        },
        items: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json(full, { status: 201 });
  } catch (error) {
    console.error("[PAYSLIPS_POST]", error);
    return NextResponse.json(
      { error: "Eroare la generarea fluturașului" },
      { status: 500 },
    );
  }
}
