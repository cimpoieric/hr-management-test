/**
 * PUT / DELETE — firmă (admin)
 */

import { requireRole } from "@/lib/auth";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  taxCode: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  countryId: z.number().int().positive().nullable().optional(),
  status: z.enum(["Activ", "Inactiv"]).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_SETTINGS_ADMIN,
  );
  if (authError || !user) return authError!;

  try {
    const { id } = await params;
    const companyId = Number.parseInt(id, 10);
    if (isNaN(companyId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const raw = await request.json();
    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const existing = await prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Firmă negăsită" }, { status: 404 });
    }

    const d = parsed.data;
    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        ...(d.name !== undefined ? { name: d.name.trim() } : {}),
        ...(d.taxCode !== undefined
          ? { taxCode: d.taxCode?.trim() || null }
          : {}),
        ...(d.address !== undefined
          ? { address: d.address?.trim() || null }
          : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
        ...(d.countryId !== undefined
          ? d.countryId === null
            ? { country: { disconnect: true } }
            : { country: { connect: { id: d.countryId } } }
          : {}),
      },
      include: {
        country: { select: { id: true, name: true, code: true } },
        _count: { select: { employees: true } },
      },
    });

    return NextResponse.json({ company }, { status: 200 });
  } catch (error: unknown) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code.includes("Unique")) {
      return NextResponse.json(
        { error: "Există deja o firmă cu acest nume" },
        { status: 409 },
      );
    }
    console.error("[SETTINGS_COMPANY_PUT]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_SETTINGS_ADMIN,
  );
  if (authError || !user) return authError!;

  try {
    const { id } = await params;
    const companyId = Number.parseInt(id, 10);
    if (isNaN(companyId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const existing = await prisma.company.findUnique({
      where: { id: companyId },
      include: { _count: { select: { employees: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Firmă negăsită" }, { status: 404 });
    }
    if (existing._count.employees > 0) {
      return NextResponse.json(
        {
          error: "Nu se poate șterge: există angajați legați de această firmă",
        },
        { status: 409 },
      );
    }

    await prisma.company.delete({ where: { id: companyId } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[SETTINGS_COMPANY_DELETE]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
