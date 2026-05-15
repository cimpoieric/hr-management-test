/**
 * POST /api/firm/upgrade
 */

import { requireOrgAdmin } from "@/lib/auth";
import { upgradeFirmPlan } from "@/lib/firmPlan";
import type { PlanName } from "@/lib/plan-features";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  targetPlan: z.enum(["BUSINESS", "ENTERPRISE", "CUSTOM"]),
});

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireOrgAdmin(request);
  if (authError || !user) return authError!;

  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const plan = await upgradeFirmPlan(
      user.organizationId,
      parsed.data.targetPlan as PlanName,
    );

    return NextResponse.json({
      success: true,
      message: `Plan actualizat la ${parsed.data.targetPlan}`,
      plan,
    });
  } catch (error) {
    console.error("[FIRM_UPGRADE]", error);
    const msg =
      error instanceof Error ? error.message : "Eroare la upgrade";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
