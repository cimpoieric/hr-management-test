import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prismaTyped as prisma } from "@/lib/prisma";
import { requireAuth, WRITE_ROLES } from "@/lib/auth";
import { generatePayslipPdf } from "@/lib/services/payslipPdf";
import { sendFluturasEmail } from "@/lib/email";
import { getEmailSettings } from "@/lib/services/email";

const bodySchema = z.object({
  payslipIds: z.array(z.coerce.number().int().positive()).min(1).max(500),
});

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request, WRITE_ROLES);
  if (authError || !user) return authError!;

  try {
    const settings = await getEmailSettings();
    if (!settings || !settings.smtpHost) {
      return NextResponse.json(
        { error: "Setarile email nu sunt configurate. Contactati administratorul." },
        { status: 400 }
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
        const p = await prisma.payslip.findUnique({
          where: { id: payslipId },
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, email: true, position: true } },
            company: { select: { id: true, name: true, address: true } },
            timesheet: { select: { id: true, hoursWorked: true } },
            items: { orderBy: { sortOrder: "asc" } },
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

        const currency = String(p.currency ?? "EUR").toUpperCase();
        const netSalary = p.items.find((i) => i.type === "NET_SALARY")?.amount ?? 0;
        const travel = p.items.find((i) => i.type === "TRAVEL_ALLOWANCE")?.amount ?? 0;
        const holiday = p.items.find((i) => i.type === "HOLIDAY_MONEY")?.amount ?? 0;

        const r = await sendFluturasEmail({
          angajatEmail: toEmail,
          angajatNume: `${String(p.employee.lastName ?? "").trim()} ${String(p.employee.firstName ?? "").trim()}`.trim(),
          angajatId: String(p.employeeId),
          pozitie: String(p.employee.position ?? "").trim(),
          saptamana: p.weekNumber,
          an: p.year,
          perioadaStart: new Date(p.periodStart).toLocaleDateString("ro-RO"),
          perioadaEnd: new Date(p.periodEnd).toLocaleDateString("ro-RO"),
          oreLucrate: Number(String(p.timesheet.hoursWorked)),
          salariuOreLucrate: Number(String(netSalary)),
          salariuNet: Number(String(netSalary)),
          diurna: Number(String(travel)),
          totalPlatit: Number(String(p.totalPaid)),
          holidayMoney: Number(String(holiday)),
          moneda: currency,
          numeFirma: String(p.company.name ?? "Cedol Autocraft SRL"),
          adresaFirma: String(p.company.address ?? ""),
        });

        await prisma.payslip.update({
          where: { id: p.id },
          data: { emailSent: true, emailSentAt: new Date(), emailLogId: r.emailLogId || null },
          select: { id: true },
        });

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
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Eroare la trimiterea în masă";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

