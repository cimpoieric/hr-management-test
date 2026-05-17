import { logAudit } from "@/lib/audit";
import { generatePayslipFromTimesheet } from "@/lib/payslipFromTimesheet";
import { checkPlan, FEATURES } from "@/lib/middleware/plan-check";
import { ROLES_PAYROLL } from "@/lib/roles";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  timesheetId: z.coerce.number().int().positive(),
});

export async function POST(request: NextRequest) {
  const planCheck = await checkPlan(request, FEATURES.PAYROLL_SLIPS, {
    roles: ROLES_PAYROLL,
  });
  if (!planCheck.allowed) return planCheck.response;

  try {
    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Body invalid" }, { status: 400 });
    }

    const result = await generatePayslipFromTimesheet(parsed.data.timesheetId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { user } = planCheck;
    void logAudit({
      userId: user.userId,
      userEmail: user.email,
      action: "PAYSLIP_CREATED",
      resource: "Payslip",
      resourceId: result.payslip?.id ?? parsed.data.timesheetId,
      details: { timesheetId: parsed.data.timesheetId },
      req: request,
    });
    return NextResponse.json(result.payslip, { status: result.status });
  } catch (error) {
    console.error("[PAYSLIPS_GENERATE_POST]", error);
    return NextResponse.json(
      { error: "Eroare la generarea fluturașului" },
      { status: 500 },
    );
  }
}
