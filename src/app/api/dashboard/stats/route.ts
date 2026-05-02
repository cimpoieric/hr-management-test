import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDashboardStats } from "@/lib/dashboardStats";

/**
 * GET /api/dashboard/stats
 * KPI-uri din baza de date (angajați, documente, importuri, detașări, cost salarial).
 */
export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const payload = await getDashboardStats();
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error("[DASHBOARD_STATS_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
