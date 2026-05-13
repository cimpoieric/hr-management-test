/**
 * GET /api/organization/countries — lista țări (dropdown-uri). Autentificat.
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
