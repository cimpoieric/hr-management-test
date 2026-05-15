import { sendPayslipFluturasById } from "@/lib/email";
import { checkPlan, FEATURES } from "@/lib/middleware/plan-check";
import { ROLES_PAYROLL } from "@/lib/roles";
import { isSmtpConfigured } from "@/lib/services/email";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    const payslipId = Number.parseInt(id, 10);
    if (isNaN(payslipId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const result = await sendPayslipFluturasById(payslipId);
    return NextResponse.json({
      success: true,
      message: "Email trimis",
      emailLogId: result.emailLogId,
    });
  } catch (error) {
    console.error("[PAYSLIP_SEND_POST]", error);
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Eroare la trimiterea emailului";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
