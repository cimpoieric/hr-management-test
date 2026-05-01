/**
 * GET /api/companies
 *
 * Lista firme active. Orice utilizator autentificat poate accesa.
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "@/lib/auth";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  // ─── Auth ────────────────────────────────────────────────────────────
  const { user, response: authError } = await requireAuth(request);

  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const companies = await prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        cui: true,
        city: true,
        country: true,
        _count: { select: { employees: true } },
      },
    });

    return NextResponse.json({ companies }, { status: 200 });
  } catch (error) {
    console.error("[COMPANIES_GET]", error);
    return NextResponse.json(
      { error: "Eroare server intern" },
      { status: 500 }
    );
  }
}
