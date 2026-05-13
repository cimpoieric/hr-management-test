import { requireAuth } from "@/lib/auth";
import { prismaTyped as prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
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
  action: "CREATE" | "UPDATE",
  entityId: number | null,
  newValues: unknown,
  request: NextRequest,
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity: "Timesheet",
        entityId,
        newValues: JSON.stringify(newValues),
        ipAddress: getClientIp(request),
      },
    });
  } catch (e) {
    console.error("[AUDIT_LOG_TIMESHEET]", e);
  }
}

// Query params sunt opționali în App Router; validăm doar tipul și constrângeri simple.
const querySchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
  employeeId: z.number().int().positive().optional(),
  year: z.number().int().optional(),
  weekNumber: z.number().int().positive().optional(),
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
    weekNumber: z.coerce.number().int().min(1).max(52),
    year: z.coerce.number().int().min(2024).max(2030),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    hoursWorked: z.coerce.number().min(0.5).max(80),
    standardHours: z.coerce.number().min(0).max(80).optional().default(40),
    travelAllowance: z.coerce
      .number()
      .min(0)
      .max(1_000_000)
      .optional()
      .default(0),
    dailyBreakdown: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((v) => v.startDate < v.endDate, {
    message: "startDate trebuie să fie înainte de endDate",
    path: ["endDate"],
  });

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
      status,
    });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Parametri query invalizi";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const where: Prisma.TimesheetWhereInput = {
      employeeId,
      year,
      weekNumber,
      status: status ? { equals: status } : undefined,
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
            },
          },
        },
      }),
      prisma.timesheet.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return NextResponse.json({
      items,
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

    const {
      employeeId,
      weekNumber,
      year,
      startDate,
      endDate,
      hoursWorked,
      standardHours,
      travelAllowance,
      dailyBreakdown,
      notes,
    } = parsed.data;

    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { organizationId: true },
    });
    if (!emp) {
      return NextResponse.json({ error: "Angajat negasit" }, { status: 404 });
    }

    const existing = await prisma.timesheet.findUnique({
      where: {
        employeeId_year_weekNumber: { employeeId, year, weekNumber },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        {
          error:
            "Există deja un pontaj pentru acest angajat în săptămâna/anul selectat",
        },
        { status: 400 },
      );
    }

    const created = await prisma.timesheet.create({
      data: {
        organizationId: emp.organizationId,
        employeeId,
        weekNumber,
        year,
        startDate,
        endDate,
        hoursWorked,
        standardHours,
        travelAllowance,
        dailyBreakdown,
        notes,
        status: "DRAFT",
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, position: true },
        },
      },
    });

    await logAudit("CREATE", created.id, created, request);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[TIMESHEETS_POST]", error);
    return NextResponse.json(
      { error: "Eroare la crearea pontajului" },
      { status: 500 },
    );
  }
}
