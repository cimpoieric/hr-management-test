/**
 * GET /api/deployments/stats
 *
 * Returnează numărul de detașări active per țară.
 * Util pentru cardul din dashboard.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { DEPLOYMENT_COUNTRIES } from "@/lib/countries";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    // Query brută — group by country pe status ACTIVE
    // SQLite Prisma nu are groupBy direct pentru count, facem în JS
    const activeDeployments = await prisma.deployment.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
      select: { country: true },
    });

    // Contorizează per țară
    const byCountry: Record<string, number> = {};
    for (const dep of activeDeployments) {
      byCountry[dep.country] = (byCountry[dep.country] ?? 0) + 1;
    }

    const stats = DEPLOYMENT_COUNTRIES.map((country) => ({
      code: country.code,
      name: country.name,
      flag: country.flag,
      count: byCountry[country.code] ?? 0,
    })).filter((s) => s.count > 0);

    const total = activeDeployments.length;

    return NextResponse.json({ stats, total }, { status: 200 });
  } catch (error) {
    console.error("[DEPLOYMENTS_STATS]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
