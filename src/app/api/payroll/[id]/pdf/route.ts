import { requireRole } from "@/lib/auth";
import { ROLES_PAYROLL } from "@/lib/roles";
import { prismaTyped as prisma } from "@/lib/prisma";
import { generatePayslipPdf } from "@/lib/services/payslipPdf";
import { type NextRequest, NextResponse } from "next/server";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

async function logAudit(
  action: "UPDATE",
  entityId: number,
  newValues: unknown,
  request: NextRequest,
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity: "Payslip",
        entityId,
        newValues: JSON.stringify(newValues),
        ipAddress: getClientIp(request),
      },
    });
  } catch (e) {
    console.error("[AUDIT_LOG_PAYSLIP_PDF]", e);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_PAYROLL,
  );
  if (authError || !user) return authError!;

  try {
    const { id } = await params;
    const payslipId = Number.parseInt(id, 10);
    if (isNaN(payslipId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const pdf = await generatePayslipPdf(payslipId);
    const updated = await prisma.payslip.findUnique({
      where: { id: payslipId },
      select: { id: true, pdfPath: true, pdfGeneratedAt: true },
    });
    if (updated) {
      await logAudit("UPDATE", payslipId, updated, request);
    }

    return new NextResponse(Buffer.from(pdf.pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${pdf.fileName}"`,
        "Content-Length": String(pdf.pdfBytes.byteLength),
      },
    });
  } catch (error) {
    console.error("[PAYSLIP_PDF_GET]", error);
    return NextResponse.json(
      { error: "Eroare la generare PDF" },
      { status: 500 },
    );
  }
}
