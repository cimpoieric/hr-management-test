import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getEmployeeStats } from "@/lib/employeeStats";

/** GET /api/employees/stats — KPI angajați (aceleași valori ca panoul de control). */
export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const stats = await getEmployeeStats();
    return NextResponse.json(stats, { status: 200 });
  } catch (error) {
    console.error("[EMPLOYEES_STATS_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
