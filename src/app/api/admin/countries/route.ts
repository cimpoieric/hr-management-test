import { withAdminApi } from "@/lib/adminApi";
import { prismaBase as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(2).max(3),
  phoneCode: z.string().max(12).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  return withAdminApi(request, async () => {
    const countries = await prisma.country.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { employees: true, companies: true } },
      },
    });

    return NextResponse.json({
      countries: countries.map((country) => ({
        id: country.id,
        name: country.name,
        code: country.code,
        phoneCode: country.phoneCode,
        isActive: country.isActive,
        employeeCount: country._count.employees,
        companyCount: country._count.companies,
        createdAt: country.createdAt.toISOString(),
      })),
    });
  });
}

export async function POST(request: NextRequest) {
  return withAdminApi(request, async () => {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    try {
      const country = await prisma.country.create({
        data: {
          name: parsed.data.name.trim(),
          code: parsed.data.code.trim().toUpperCase(),
          phoneCode: parsed.data.phoneCode?.trim() || null,
          isActive: parsed.data.isActive ?? true,
        },
      });

      return NextResponse.json({ country }, { status: 201 });
    } catch (error: unknown) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : "";
      if (code.includes("Unique")) {
        return NextResponse.json(
          { error: "Denumire sau cod duplicat" },
          { status: 409 },
        );
      }
      throw error;
    }
  });
}
