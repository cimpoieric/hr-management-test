/**
 * GET /api/countries — lista țări (dropdown-uri). Autentificat.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const countries = await prisma.country.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        phoneCode: true,
      },
    });
    return NextResponse.json({ countries }, { status: 200 });
  } catch (error) {
    console.error("[COUNTRIES_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
