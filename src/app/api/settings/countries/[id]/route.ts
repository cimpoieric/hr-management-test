/**
 * PUT / DELETE — țară (admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, WRITE_ROLES } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  code: z.string().min(2).max(3).optional(),
  phoneCode: z.string().max(12).nullable().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response: authError } = await requireAuth(request, WRITE_ROLES);
  if (authError || !user) return authError!;

  try {
    const { id } = await params;
    const countryId = parseInt(id, 10);
    if (isNaN(countryId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const raw = await request.json();
    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Date invalide", issues: parsed.error.issues }, { status: 400 });
    }

    const existing = await prisma.country.findUnique({ where: { id: countryId } });
    if (!existing) {
      return NextResponse.json({ error: "Țară negăsită" }, { status: 404 });
    }

    const d = parsed.data;
    const country = await prisma.country.update({
      where: { id: countryId },
      data: {
        ...(d.name !== undefined ? { name: d.name.trim() } : {}),
        ...(d.code !== undefined ? { code: d.code.trim().toUpperCase() } : {}),
        ...(d.phoneCode !== undefined ? { phoneCode: d.phoneCode?.trim() || null } : {}),
      },
      include: {
        _count: { select: { employees: true, companies: true } },
      },
    });

    return NextResponse.json({ country }, { status: 200 });
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code) : "";
    if (code.includes("Unique")) {
      return NextResponse.json({ error: "Denumire sau cod duplicat" }, { status: 409 });
    }
    console.error("[SETTINGS_COUNTRY_PUT]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response: authError } = await requireAuth(request, WRITE_ROLES);
  if (authError || !user) return authError!;

  try {
    const { id } = await params;
    const countryId = parseInt(id, 10);
    if (isNaN(countryId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const existing = await prisma.country.findUnique({
      where: { id: countryId },
      include: { _count: { select: { employees: true, companies: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Țară negăsită" }, { status: 404 });
    }
    if (existing._count.employees > 0 || existing._count.companies > 0) {
      return NextResponse.json(
        { error: "Nu se poate șterge: există firme sau angajați legați de această țară" },
        { status: 409 }
      );
    }

    await prisma.country.delete({ where: { id: countryId } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[SETTINGS_COUNTRY_DELETE]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
