import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prismaTyped as prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { sendPayslipEmail } from "@/lib/services/email";
import { generatePayslipPdf } from "@/lib/services/payslipPdf";

const bodySchema = z.object({
  payslipIds: z.array(z.coerce.number().int().positive()).min(1).max(500),
});

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request, [
    "ADMIN",
    "OPERATOR",
    "ACCOUNTING",
  ]);
  if (authError || !user) return authError!;

  try {
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
        const p = await prisma.payslip.findUnique({
          where: { id: payslipId },
          select: {
            id: true,
            pdfPath: true,
            pdfGeneratedAt: true,
            employee: { select: { email: true } },
          },
        });

        if (!p) {
          failed.push({ payslipId, error: "Fluturaș inexistent" });
          continue;
        }

        if (!p.pdfPath || !p.pdfGeneratedAt) {
          await generatePayslipPdf(payslipId);
        }

        const toEmail = (p.employee.email ?? "").trim();
        if (!toEmail) {
          failed.push({ payslipId, error: "Angajatul nu are email setat" });
          continue;
        }

        const r = await sendPayslipEmail({ payslipId, toEmail });
        sent.push({ payslipId, emailLogId: r.emailLogId });
      } catch (e) {
        failed.push({
          payslipId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return NextResponse.json({ sent, failed });
  } catch (error) {
    console.error("[PAYSLIPS_BULK_SEND_POST]", error);
    return NextResponse.json({ error: "Eroare la trimiterea în masă" }, { status: 500 });
  }
}

