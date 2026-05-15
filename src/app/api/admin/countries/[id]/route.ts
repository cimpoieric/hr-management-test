import { withAdminApi } from "@/lib/adminApi";
import { prismaBase as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  code: z.string().min(2).max(3).optional(),
  phoneCode: z.string().max(12).nullable().optional(),
  isActive: z.boolean().optional(),
});

function mapAdminCountry(country: {
  id: number;
  name: string;
  code: string;
  phoneCode: string | null;
  isActive: boolean;
  createdAt: Date;
  _count: { employees: number; companies: number };
}) {
  return {
    id: country.id,
    name: country.name,
    code: country.code,
    phoneCode: country.phoneCode,
    isActive: country.isActive,
    employeeCount: country._count.employees,
    companyCount: country._count.companies,
    createdAt: country.createdAt.toISOString(),
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminApi(request, async () => {
    const { id } = await params;
    const countryId = Number.parseInt(id, 10);
    if (Number.isNaN(countryId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const existing = await prisma.country.findUnique({ where: { id: countryId } });
    if (!existing) {
      return NextResponse.json({ error: "Tara negasita" }, { status: 404 });
    }

    try {
      const country = await prisma.country.update({
        where: { id: countryId },
        data: {
          ...(parsed.data.name !== undefined
            ? { name: parsed.data.name.trim() }
            : {}),
          ...(parsed.data.code !== undefined
            ? { code: parsed.data.code.trim().toUpperCase() }
            : {}),
          ...(parsed.data.phoneCode !== undefined
            ? { phoneCode: parsed.data.phoneCode?.trim() || null }
            : {}),
          ...(parsed.data.isActive !== undefined
            ? { isActive: parsed.data.isActive }
            : {}),
        },
        include: {
          _count: { select: { employees: true, companies: true } },
        },
      });

      const payload = mapAdminCountry(country);
      return NextResponse.json({ country: payload, data: payload });
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminApi(request, async () => {
    const { id } = await params;
    const countryId = Number.parseInt(id, 10);
    if (Number.isNaN(countryId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const existing = await prisma.country.findUnique({
      where: { id: countryId },
      include: { _count: { select: { employees: true, companies: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Tara negasita" }, { status: 404 });
    }
    if (existing._count.employees > 0 || existing._count.companies > 0) {
      return NextResponse.json(
        {
          error:
            "Nu se poate sterge: exista firme sau angajati legati de aceasta tara",
        },
        { status: 409 },
      );
    }

    await prisma.country.delete({ where: { id: countryId } });
    return NextResponse.json({ ok: true, deleted: true });
  });
}
