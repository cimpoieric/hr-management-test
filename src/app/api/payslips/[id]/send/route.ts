import { NextRequest, NextResponse } from "next/server";
import { prismaTyped as prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { sendPayslipEmail } from "@/lib/services/email";
import { generatePayslipPdf } from "@/lib/services/payslipPdf";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response: authError } = await requireAuth(request, [
    "ADMIN",
    "OPERATOR",
    "ACCOUNTING",
  ]);
  if (authError || !user) return authError!;

  try {
    const { id } = await params;
    const payslipId = parseInt(id, 10);
    if (isNaN(payslipId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const payslip = await prisma.payslip.findUnique({
      where: { id: payslipId },
      select: {
        id: true,
        pdfPath: true,
        pdfGeneratedAt: true,
        employee: { select: { email: true } },
      },
    });

    if (!payslip) {
      return NextResponse.json({ error: "Fluturaș inexistent" }, { status: 404 });
    }

    // Asigură PDF generat (cerință: "are PDF generat")
    if (!payslip.pdfPath || !payslip.pdfGeneratedAt) {
      await generatePayslipPdf(payslipId);
    }

    const toEmail = (payslip.employee.email ?? "").trim();
    if (!toEmail) {
      return NextResponse.json({ error: "Angajatul nu are email setat" }, { status: 400 });
    }

    const result = await sendPayslipEmail({ payslipId, toEmail });
    return NextResponse.json({
      success: true,
      message: "Email trimis",
      emailLogId: result.emailLogId,
    });
  } catch (error) {
    console.error("[PAYSLIP_SEND_POST]", error);
    return NextResponse.json({ error: "Eroare la trimiterea emailului" }, { status: 500 });
  }
}

