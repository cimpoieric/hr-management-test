/**
 * GET /api/organization/companies
 *
 * Lista firme cu status Activ (dropdown angajați). Orice utilizator autentificat.
 */

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);

  if (authError || !user) {
    return (
      authError ??
      NextResponse.json({ error: "Neautentificat" }, { status: 401 })
    );
  }

  try {
    const { searchParams } = request.nextUrl;
    const includeInactive = searchParams.get("all") === "1";

    const companies = await prisma.company.findMany({
      where: includeInactive ? undefined : { status: "Activ" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        taxCode: true,
        address: true,
        status: true,
        country: { select: { id: true, name: true, code: true } },
        _count: { select: { employees: true } },
      },
    });

    return NextResponse.json({ companies }, { status: 200 });
  } catch (error) {
    console.error("[COMPANIES_GET]", error);
    return NextResponse.json(
      { error: "Eroare server intern" },
      { status: 500 },
    );
  }
}
