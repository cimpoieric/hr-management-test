/**
 * GET /api/internal/subscription-gate
 */

import { requireAuth } from "@/lib/auth";
import { getFirmPlanSummary, syncExpiredTrialIfNeeded } from "@/lib/firmPlan";
import { isSuperAdminRole } from "@/middleware/adminAccess";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) return authError!;

  if (isSuperAdminRole(user.role)) {
    return NextResponse.json({
      blocked: false,
      trialEnding: false,
      subscriptionStatus: "active",
    });
  }

  await syncExpiredTrialIfNeeded(user.organizationId);
  const plan = await getFirmPlanSummary(user.organizationId);

  const blocked =
    plan.subscriptionStatus === "expired" || !plan.isSubscriptionActive;

  return NextResponse.json({
    blocked,
    trialEnding: plan.isTrialEndingSoon,
    subscriptionStatus: plan.subscriptionStatus,
    redirect: blocked ? "/pricing" : null,
  });
}
