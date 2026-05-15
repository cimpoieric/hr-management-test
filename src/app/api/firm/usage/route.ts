/**
 * GET /api/firm/usage
 */

import { requireOrgAdmin } from "@/lib/auth";
import { getFirmPlanSummary, getFirmUsageSummary } from "@/lib/firmPlan";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireOrgAdmin(request);
  if (authError || !user) return authError!;

  try {
    const [usage, plan] = await Promise.all([
      getFirmUsageSummary(user.organizationId),
      getFirmPlanSummary(user.organizationId),
    ]);

    return NextResponse.json({
      usage,
      plan: {
        planName: plan.planName,
        maxEmployees: plan.maxEmployees,
        employeeCount: plan.employeeCount,
        remainingEmployees: plan.remainingEmployees,
        subscriptionStatus: plan.subscriptionStatus,
        trialEndsAt: plan.trialEndsAt,
      },
    });
  } catch (error) {
    console.error("[FIRM_USAGE_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
