/**
 * GET /api/settings/countries — admin list (same as public but explicit)
 * POST — creare țară (admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(2).max(3),
  phoneCode: z.string().max(12).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request, ["ADMIN"]);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const countries = await prisma.country.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { employees: true, companies: true } },
      },
    });
    return NextResponse.json({ countries }, { status: 200 });
  } catch (error) {
    console.error("[SETTINGS_COUNTRIES_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request, ["ADMIN"]);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Date invalide", issues: parsed.error.issues }, { status: 400 });
    }
    const d = parsed.data;
    const country = await prisma.country.create({
      data: {
        name: d.name.trim(),
        code: d.code.trim().toUpperCase(),
        phoneCode: d.phoneCode?.trim() || null,
      },
    });
    return NextResponse.json({ country }, { status: 201 });
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code) : "";
    if (code.includes("Unique")) {
      return NextResponse.json({ error: "Denumire sau cod duplicat" }, { status: 409 });
    }
    console.error("[SETTINGS_COUNTRIES_POST]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
