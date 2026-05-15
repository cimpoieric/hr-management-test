/**
 * GET /api/firm/plan
 */

import { requireAuth } from "@/lib/auth";
import { getFirmPlanSummary } from "@/lib/firmPlan";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) return authError!;

  try {
    const plan = await getFirmPlanSummary(user.organizationId);
    return NextResponse.json({ plan });
  } catch (error) {
    console.error("[FIRM_PLAN_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
