/**
 * GET /api/settings/companies — toate firmele (admin)
 * POST /api/settings/companies — creare firmă (admin)
 */

import { requireRole } from "@/lib/auth";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  taxCode: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  countryId: z.number().int().positive().nullable().optional(),
  status: z.enum(["Activ", "Inactiv"]).optional(),
});

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_SETTINGS_ADMIN,
  );
  if (authError || !user) return authError!;

  try {
    const companies = await prisma.company.findMany({
      orderBy: { name: "asc" },
      include: {
        country: { select: { id: true, name: true, code: true } },
        _count: { select: { employees: true } },
      },
    });
    return NextResponse.json({ companies }, { status: 200 });
  } catch (error) {
    console.error("[SETTINGS_COMPANIES_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_SETTINGS_ADMIN,
  );
  if (authError || !user) return authError!;

  try {
    const raw = await request.json();
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const d = parsed.data;
    const company = await prisma.company.create({
      data: {
        organizationId: user.organizationId,
        name: d.name.trim(),
        taxCode: d.taxCode?.trim() || null,
        address: d.address?.trim() || null,
        countryId: d.countryId ?? null,
        status: d.status ?? "Activ",
      },
      include: {
        country: { select: { id: true, name: true, code: true } },
      },
    });
    return NextResponse.json({ company }, { status: 201 });
  } catch (error: unknown) {
    const msg =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (msg.includes("Unique")) {
      return NextResponse.json(
        { error: "Există deja o firmă cu acest nume" },
        { status: 409 },
      );
    }
    console.error("[SETTINGS_COMPANIES_POST]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
