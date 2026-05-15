/**
 * GET  /api/admin/organizations/[id]/plan
 * PATCH /api/admin/organizations/[id]/plan
 */

import { withAdminApi } from "@/lib/adminApi";
import {
  adminOverrideFirmPlan,
  getFirmPlanSummary,
  getFirmUsageSummary,
} from "@/lib/firmPlan";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const idSchema = z.string().cuid();

const overrideSchema = z.object({
  plan: z.enum(["starter", "business", "enterprise", "custom"]).optional(),
  subscriptionStatus: z.enum(["active", "trial", "expired"]).optional(),
  status: z.enum(["active", "suspended", "trial", "grace"]).optional(),
  trialEndsAt: z.string().nullable().optional(),
  featuresOverride: z.string().nullable().optional(),
  employeeCount: z.number().int().min(0).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminApi(request, async () => {
    const { id } = await params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    try {
      const [plan, usage] = await Promise.all([
        getFirmPlanSummary(parsedId.data),
        getFirmUsageSummary(parsedId.data),
      ]);
      return NextResponse.json({ plan, usage });
    } catch {
      return NextResponse.json(
        { error: "Organizatie negasita" },
        { status: 404 },
      );
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminApi(request, async () => {
    const { id } = await params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = overrideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    try {
      const plan = await adminOverrideFirmPlan(parsedId.data, {
        plan: parsed.data.plan,
        subscriptionStatus: parsed.data.subscriptionStatus,
        status: parsed.data.status,
        trialEndsAt: parsed.data.trialEndsAt,
        featuresOverride: parsed.data.featuresOverride,
        employeeCount: parsed.data.employeeCount,
      });
      return NextResponse.json({ success: true, plan });
    } catch {
      return NextResponse.json(
        { error: "Organizatie negasita" },
        { status: 404 },
      );
    }
  });
}
