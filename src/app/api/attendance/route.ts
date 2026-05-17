import { requireAuth } from "@/lib/auth";
import { logAuditForUser } from "@/lib/auditInsert";
import { createTimesheetRecord } from "@/lib/timesheetCreate";
import { prismaTyped as prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Query params sunt opționali în App Router; validăm doar tipul și constrângeri simple.
const querySchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
  employeeId: z.number().int().positive().optional(),
  year: z.number().int().optional(),
  weekNumber: z.number().int().positive().optional(),
  type: z.enum(["weekly", "monthly"]).optional(),
  month: z.number().int().min(1).max(12).optional(),
  monthYear: z.number().int().optional(),
  status: z.string().trim().optional(),
});

function parseOptionalInt(
  raw: string | null,
  fieldLabel: string,
): { value?: number; error?: string } {
  if (raw == null) return {};
  const s = raw.trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined")
    return {};
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n))
    return { error: `${fieldLabel} trebuie să fie un număr valid` };
  return { value: n };
}

function normalizeYear(y: number): { value?: number; error?: string } {
  // Acceptăm 1-2 cifre ca 20xx (ex: "26" => 2026, "2" => 2002).
  const normalized = y >= 0 && y <= 99 ? 2000 + y : y;
  if (!Number.isInteger(normalized) || normalized < 2010 || normalized > 2100) {
    return { error: "Anul trebuie să fie un număr valid (2010-2100)" };
  }
  return { value: normalized };
}

const createSchema = z
  .object({
    employeeId: z.coerce.number().int().positive(),
    type: z.enum(["weekly", "monthly"]).optional(),
    weekNumber: z.coerce.number().int().min(0).max(52).optional(),
    year: z.coerce.number().int().min(2024).max(2030).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    monthYear: z.coerce.number().int().min(2024).max(2030).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    hoursWorked: z.coerce.number().min(0.5).max(250),
    standardHours: z.coerce.number().min(0).max(250).optional(),
    travelAllowance: z.coerce
      .number()
      .min(0)
      .max(1_000_000)
      .optional()
      .default(0),
    dailyBreakdown: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (v) =>
      !v.startDate ||
      !v.endDate ||
      v.startDate < v.endDate,
    {
      message: "startDate trebuie să fie înainte de endDate",
      path: ["endDate"],
    },
  );

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return (
      authError ??
      NextResponse.json({ error: "Neautentificat" }, { status: 401 })
    );
  }

  try {
    // IMPORTANT: request.url poate fi relativ în anumite contexte (ex. fetch intern),
    // deci evităm `new URL(request.url)` și folosim direct App Router `nextUrl`.
    const searchParams = request.nextUrl.searchParams;

    const pageParsed = parseOptionalInt(searchParams.get("page"), "Pagina");
    if (pageParsed.error)
      return NextResponse.json({ error: pageParsed.error }, { status: 400 });

    const pageSizeParsed = parseOptionalInt(
      searchParams.get("pageSize"),
      "Dimensiunea paginii",
    );
    if (pageSizeParsed.error)
      return NextResponse.json(
        { error: pageSizeParsed.error },
        { status: 400 },
      );

    const employeeIdParsed = parseOptionalInt(
      searchParams.get("employeeId"),
      "employeeId",
    );
    if (employeeIdParsed.error)
      return NextResponse.json(
        { error: employeeIdParsed.error },
        { status: 400 },
      );

    const weekParsed = parseOptionalInt(
      searchParams.get("weekNumber"),
      "Săptămâna",
    );
    if (weekParsed.error)
      return NextResponse.json({ error: weekParsed.error }, { status: 400 });

    const yearRaw = searchParams.get("year");
    const yearParsedInt = parseOptionalInt(yearRaw, "Anul");
    if (yearParsedInt.error)
      return NextResponse.json({ error: yearParsedInt.error }, { status: 400 });

    const typeRaw = searchParams.get("type");
    const type =
      typeRaw === "weekly" || typeRaw === "monthly" ? typeRaw : undefined;
    const monthParsed = parseOptionalInt(searchParams.get("month"), "Luna");
    if (monthParsed.error)
      return NextResponse.json({ error: monthParsed.error }, { status: 400 });
    const monthYearParsed = parseOptionalInt(
      searchParams.get("monthYear"),
      "Anul lunii",
    );
    if (monthYearParsed.error)
      return NextResponse.json(
        { error: monthYearParsed.error },
        { status: 400 },
      );

    const statusRaw = searchParams.get("status");
    const status = statusRaw?.trim() ? statusRaw.trim() : undefined;

    // defaults + limits
    const page = Math.max(1, pageParsed.value ?? 1);
    const pageSize = Math.min(200, Math.max(1, pageSizeParsed.value ?? 50));
    const employeeId = employeeIdParsed.value;
    const weekNumber = weekParsed.value;

    const yearNormalized =
      yearParsedInt.value == null
        ? undefined
        : normalizeYear(yearParsedInt.value);
    if (yearNormalized?.error)
      return NextResponse.json(
        { error: yearNormalized.error },
        { status: 400 },
      );
    const year = yearNormalized?.value;

    // Zod: doar shape / tip (opțional) — nu mai impune valori fixe.
    const parsed = querySchema.safeParse({
      page,
      pageSize,
      employeeId,
      year,
      weekNumber,
      type,
      month: monthParsed.value,
      monthYear: monthYearParsed.value,
      status,
    });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Parametri query invalizi";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const where: Prisma.TimesheetWhereInput = {
      ...(employeeId != null ? { employeeId } : {}),
      ...(year != null ? { year } : {}),
      ...(weekNumber != null ? { weekNumber } : {}),
      ...(type ? { type } : {}),
      ...(monthParsed.value != null ? { month: monthParsed.value } : {}),
      ...(monthYearParsed.value != null
        ? { monthYear: monthYearParsed.value }
        : {}),
      ...(status ? { status: { equals: status } } : {}),
    };

    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.timesheet.findMany({
        where,
        orderBy: [{ year: "desc" }, { weekNumber: "desc" }, { id: "desc" }],
        skip,
        take: pageSize,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              position: true,
              salaryType: true,
              salaryAmount: true,
              salaryCurrency: true,
              paymentFrequency: true,
            },
          },
        },
      }),
      prisma.timesheet.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const serialized = items.map((row) => ({
      ...row,
      type: row.type || "weekly",
      periodKey: row.periodKey,
      hoursWorked: String(row.hoursWorked),
      standardHours: String(row.standardHours),
      travelAllowance: String(row.travelAllowance ?? 0),
      employee: row.employee
        ? {
            ...row.employee,
            paymentFrequency: row.employee.paymentFrequency || "weekly",
            salaryAmount:
              row.employee.salaryAmount != null
                ? String(row.employee.salaryAmount)
                : null,
          }
        : row.employee,
    }));

    return NextResponse.json({
      items: serialized,
      pagination: { page, pageSize, total, totalPages },
    });
  } catch (error) {
    console.error("[TIMESHEETS_GET]", error);
    return NextResponse.json(
      { error: "Eroare la listarea pontajelor" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return (
      authError ??
      NextResponse.json({ error: "Neautentificat" }, { status: 401 })
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Body invalid" },
        { status: 400 },
      );
    }

    const result = await createTimesheetRecord(parsed.data);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    logAuditForUser(user, request, {
      action: "TIMESHEET_CREATED",
      resource: "Timesheet",
      resourceId: result.timesheet.id,
      newValues: JSON.stringify(result.timesheet),
    });
    return NextResponse.json(result.timesheet, { status: result.status });
  } catch (error) {
    console.error("[TIMESHEETS_POST]", error);
    return NextResponse.json(
      { error: "Eroare la crearea pontajului" },
      { status: 500 },
    );
  }
}
