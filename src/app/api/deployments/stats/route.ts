/**
 * GET /api/deployments/stats
 *
 * Repartizare per țară + total — `getDeploymentStats` (aceeași sursă ca panoul de control).
 */

import { requireAuth } from "@/lib/auth";
import { DEPLOYMENT_COUNTRIES } from "@/lib/countries";
import { getDeploymentStats } from "@/lib/deploymentStats";
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
    const at = new Date();
    const { activeCount, byCountry: rawByCountry } =
      await getDeploymentStats(at);

    const byCountryMap: Record<string, number> = {};
    for (const row of rawByCountry) {
      byCountryMap[row.code] = row.count;
    }

    const stats = DEPLOYMENT_COUNTRIES.map((country) => ({
      code: country.code,
      name: country.name,
      flag: country.flag,
      count: byCountryMap[country.code] ?? 0,
    })).filter((s) => s.count > 0);

    return NextResponse.json({ stats, total: activeCount }, { status: 200 });
  } catch (error) {
    console.error("[DEPLOYMENTS_STATS]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
