import { withAuditContext } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { ROLES_PAYROLL } from "@/lib/roles";
import { sendFluturasEmail } from "@/lib/email";
import { prismaTyped as prisma } from "@/lib/prisma";
import {
  getEmailSettings,
  getSMTPConfig,
  testSMTPConfig,
} from "@/lib/services/email";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const postSchema = z.object({
  // requested DTO: angajatiIds: string[]
  angajatiIds: z.array(z.string().min(1)).min(1).max(500),
  subiect: z.string().min(1).max(200).optional(),
});

function formatRoDate(d: Date): string {
  const dt = new Date(d);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = String(dt.getFullYear());
  return `${dd}.${mm}.${yyyy}`;
}

export async function POST(request: NextRequest) {
  return withAuditContext(request, async () => {
    const { user, response: authError } = await requireRole(
      request,
      ROLES_PAYROLL,
    );
    if (authError || !user) return authError!;

    try {
      const body = await request.json().catch(() => null);
      const parsed = postSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Body invalid" }, { status: 400 });
      }

      // NOTE: In UI, selection is per row (payslip). We treat angajatiIds as payslipIds.
      const payslipIds = parsed.data.angajatiIds
        .map((s) => Number(String(s).trim()))
        .filter((n) => Number.isFinite(n) && n > 0);

      if (payslipIds.length === 0) {
        return NextResponse.json({ error: "Empty list" }, { status: 400 });
      }

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

      // (A) Rate limiting: max 50 emails/minute (server-side, DB-backed)
      const now = Date.now();
      const oneMinuteAgo = new Date(now - 60_000);
      const sentLastMinute = await prisma.emailLog.count({
        where: {
          createdAt: { gt: oneMinuteAgo },
          templateKey: "PAYSLIP_HTML",
        },
      });
      if (sentLastMinute + payslipIds.length > 50) {
        return NextResponse.json(
          {
            error:
              "Rate limit: maxim 50 email-uri/minut. Incearca din nou mai tarziu.",
          },
          { status: 429 },
        );
      }

      // (B) Verify email settings exist + SMTP works. If missing -> 400 with requested message.
      try {
        const cfg = await getSMTPConfig();
        await testSMTPConfig(cfg);
      } catch (e) {
        console.error("[FLUTURASI_SEND_EMAIL_SMTP_MISSING]", e);
        return NextResponse.json(
          {
            error:
              "Setarile email nu sunt configurate. Contactati administratorul.",
          },
          { status: 400 },
        );
      }

      const detalii: Array<
        | {
            angajatId: string;
            status: "trimis";
            email: string;
            payslipId: number;
            emailLogId: number;
          }
        | {
            angajatId: string;
            status: "esuat";
            eroare: string;
            payslipId?: number;
            email?: string;
          }
      > = [];

      for (const payslipId of payslipIds) {
        try {
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
            detalii.push({
              angajatId: String(payslipId),
              status: "esuat",
              eroare: "Fluturas inexistent",
              payslipId,
            });
            continue;
          }

          const toAddress = (payslip.employee.email ?? "").trim();
          if (!toAddress) {
            detalii.push({
              angajatId: String(payslip.employeeId),
              status: "esuat",
              eroare: "Angajatul nu are email setat",
              payslipId,
            });
            continue;
          }

          const currency = String(payslip.currency ?? "EUR").toUpperCase();
          const netSalary =
            payslip.items.find((i) => i.type === "NET_SALARY")?.amount ?? 0;
          const travel =
            payslip.items.find((i) => i.type === "TRAVEL_ALLOWANCE")?.amount ??
            0;
          const holiday =
            payslip.items.find((i) => i.type === "HOLIDAY_MONEY")?.amount ?? 0;

          const r = await sendFluturasEmail({
            angajatEmail: toAddress,
            angajatNume:
              `${String(payslip.employee.lastName ?? "").trim()} ${String(
                payslip.employee.firstName ?? "",
              ).trim()}`.trim(),
            angajatId: String(payslip.employeeId),
            pozitie: String(payslip.employee.position ?? "").trim(),
            saptamana: payslip.weekNumber,
            an: payslip.year,
            perioadaStart: formatRoDate(payslip.periodStart),
            perioadaEnd: formatRoDate(payslip.periodEnd),
            oreLucrate: Number(String(payslip.timesheet.hoursWorked)),
            salariuOreLucrate: Number(String(netSalary)),
            salariuNet: Number(String(netSalary)),
            diurna: Number(String(travel)),
            totalPlatit: Number(String(payslip.totalPaid)),
            holidayMoney: Number(String(holiday)),
            moneda: currency,
            subiect: parsed.data.subiect,
            numeFirma: String(payslip.company.name ?? "Cedol Autocraft SRL"),
            adresaFirma: String(payslip.company.address ?? ""),
          });

          await prisma.payslip.update({
            where: { id: payslip.id },
            data: {
              emailSent: true,
              emailSentAt: new Date(),
              emailLogId: r.emailLogId || null,
            },
            select: { id: true },
          });

          detalii.push({
            angajatId: String(payslip.employeeId),
            status: "trimis",
            email: toAddress,
            payslipId,
            emailLogId: r.emailLogId,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          detalii.push({
            angajatId: String(payslipId),
            status: "esuat",
            eroare: msg,
            payslipId,
          });
          console.error("[FLUTURASI_SEND_EMAIL_POST]", { payslipId }, err);
        }
      }

      const total = payslipIds.length;
      const trimise = detalii.filter((d) => d.status === "trimis").length;
      const esuate = total - trimise;

      const payload = { success: trimise > 0, total, trimise, esuate, detalii };
      if (trimise === 0 && esuate > 0) {
        const failed = detalii.find((x) => x.status === "esuat");
        const firstErr =
          failed && "eroare" in failed
            ? String(failed.eroare)
            : "Toate trimiterile au esuat.";
        return NextResponse.json(
          { ...payload, error: firstErr },
          { status: 422 },
        );
      }
      return NextResponse.json(payload);
    } catch (e) {
      console.error("[FLUTURASI_SEND_EMAIL_POST_FATAL]", e);
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "Trimiterea in masa a esuat";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  });
}
