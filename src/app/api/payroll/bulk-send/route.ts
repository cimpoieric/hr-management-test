import { logAudit } from "@/lib/audit";
import { sendPayslipFluturasById } from "@/lib/email";
import { checkPlan, FEATURES } from "@/lib/middleware/plan-check";
import { ROLES_PAYROLL } from "@/lib/roles";
import { isSmtpConfigured } from "@/lib/services/email";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  payslipIds: z.array(z.coerce.number().int().positive()).min(1).max(500),
});

export async function POST(request: NextRequest) {
  const planCheck = await checkPlan(request, FEATURES.PAYROLL_SLIPS, {
    roles: ROLES_PAYROLL,
  });
  if (!planCheck.allowed) return planCheck.response;

  try {
    if (!(await isSmtpConfigured())) {
      return NextResponse.json(
        {
          error:
            "Serviciul de email nu este configurat (SMTP in Vercel sau Setari email).",
        },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Body invalid" }, { status: 400 });
    }

    const { payslipIds } = parsed.data;

    const sent: Array<{ payslipId: number; emailLogId: number }> = [];
    const failed: Array<{ payslipId: number; error: string }> = [];

    for (const payslipId of payslipIds) {
      try {
        const r = await sendPayslipFluturasById(payslipId);
        sent.push({ payslipId, emailLogId: r.emailLogId });
      } catch (e) {
        failed.push({
          payslipId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const { user } = planCheck;
    for (const row of sent) {
      void logAudit({
        userId: user.userId,
        userEmail: user.email,
        action: "PAYSLIP_SENT",
        resource: "Payslip",
        resourceId: row.payslipId,
        details: { emailLogId: row.emailLogId, bulk: true },
        req: request,
      });
    }

    return NextResponse.json({ sent, failed });
  } catch (error) {
    console.error("[PAYSLIPS_BULK_SEND_POST]", error);
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Eroare la trimiterea în masă";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
