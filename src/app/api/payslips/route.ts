import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prismaTyped as prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

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

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(200, parseInt(searchParams.get("pageSize") ?? "50", 10) || 50);

    const parsed = querySchema.safeParse({
      page,
      pageSize,
      employeeId: searchParams.get("employeeId") ?? undefined,
      year: searchParams.get("year") ?? undefined,
      weekNumber: searchParams.get("weekNumber") ?? undefined,
      emailSent: searchParams.get("emailSent") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Parametri query invalizi" }, { status: 400 });
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
          employee: { select: { firstName: true, lastName: true } },
          timesheet: { select: { hoursWorked: true, status: true } },
          items: { select: { type: true, amount: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
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
    return NextResponse.json({ error: "Eroare la listarea fluturașilor" }, { status: 500 });
  }
}

