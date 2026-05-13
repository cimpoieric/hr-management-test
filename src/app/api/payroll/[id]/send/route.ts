import { requireRole } from "@/lib/auth";
import { ROLES_PAYROLL } from "@/lib/roles";
import { sendFluturasEmail } from "@/lib/email";
import { prismaTyped as prisma } from "@/lib/prisma";
import { getEmailSettings } from "@/lib/services/email";
import { generatePayslipPdf } from "@/lib/services/payslipPdf";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_PAYROLL,
  );
  if (authError || !user) return authError!;

  try {
    const settings = await getEmailSettings();
    if (!settings || !settings.smtpHost) {
      return NextResponse.json(
        {
          error:
            "Setarile email nu sunt configurate. Contactati administratorul.",
        },
        { status: 400 },
      );
    }

    const { id } = await params;
    const payslipId = Number.parseInt(id, 10);
    if (isNaN(payslipId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const payslip = await prisma.payslip.findUnique({
      where: { id: payslipId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            position: true,
          },
        },
        company: { select: { id: true, name: true, address: true } },
        timesheet: { select: { id: true, hoursWorked: true } },
        items: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!payslip) {
      return NextResponse.json(
        { error: "Fluturaș inexistent" },
        { status: 404 },
      );
    }

    try {
      if (!payslip.pdfPath || !payslip.pdfGeneratedAt) {
        await generatePayslipPdf(payslipId);
      }
    } catch (e) {
      console.error(
        "[PAYSLIP_SEND_POST] generatePayslipPdf failed (continuă fără PDF atașat)",
        payslipId,
        e,
      );
    }

    const toEmail = (payslip.employee.email ?? "").trim();
    if (!toEmail) {
      return NextResponse.json(
        { error: "Angajatul nu are email setat" },
        { status: 400 },
      );
    }

    const currency = String(payslip.currency ?? "EUR").toUpperCase();
    const netSalary =
      payslip.items.find((i) => i.type === "NET_SALARY")?.amount ?? 0;
    const travel =
      payslip.items.find((i) => i.type === "TRAVEL_ALLOWANCE")?.amount ?? 0;
    const holiday =
      payslip.items.find((i) => i.type === "HOLIDAY_MONEY")?.amount ?? 0;

    const result = await sendFluturasEmail({
      to: toEmail,
      angajatNume:
        `${String(payslip.employee.lastName ?? "").trim()} ${String(payslip.employee.firstName ?? "").trim()}`.trim(),
      angajatId: String(payslip.employeeId),
      pozitie: String(payslip.employee.position ?? "").trim(),
      saptamana: payslip.weekNumber,
      an: payslip.year,
      perioadaStart: new Date(payslip.periodStart).toLocaleDateString("ro-RO"),
      perioadaEnd: new Date(payslip.periodEnd).toLocaleDateString("ro-RO"),
      oreLucrate: Number(String(payslip.timesheet.hoursWorked)),
      salariuOreLucrate: Number(String(netSalary)),
      salariuNet: Number(String(netSalary)),
      diurna: Number(String(travel)),
      totalPlatit: Number(String(payslip.totalPaid)),
      holidayMoney: Number(String(holiday)),
      moneda: currency,
      numeFirma: String(payslip.company.name ?? "Cedol Autocraft SRL"),
      adresaFirma: String(payslip.company.address ?? ""),
    });
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
