/**
 * POST /api/firm/start-trial
 */

import { requireOrgAdmin } from "@/lib/auth";
import { startFirmTrial } from "@/lib/firmPlan";
import type { PlanName } from "@/lib/plan-features";
import { TRIAL_DAYS_DEFAULT } from "@/lib/planCatalog";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  trialPlan: z
    .enum(["STARTER", "BUSINESS", "ENTERPRISE"])
    .optional()
    .default("BUSINESS"),
});

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireOrgAdmin(request);
  if (authError || !user) return authError!;

  try {
    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    const trialPlan = (parsed.success
      ? parsed.data.trialPlan
      : "BUSINESS") as PlanName;

    const plan = await startFirmTrial(user.organizationId, { trialPlan });

    return NextResponse.json({
      success: true,
      message: `Trial activat pentru ${TRIAL_DAYS_DEFAULT} zile (plan ${trialPlan})`,
      plan,
    });
  } catch (error) {
    console.error("[FIRM_START_TRIAL]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
