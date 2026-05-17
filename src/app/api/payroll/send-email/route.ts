import { logAudit, withAuditContext } from "@/lib/audit";
import { checkPlan, FEATURES } from "@/lib/middleware/plan-check";
import { ROLES_PAYROLL } from "@/lib/roles";
import { sendPayslipFluturasById } from "@/lib/email";
import { prismaTyped as prisma } from "@/lib/prisma";
import {
  getSMTPConfig,
  isSmtpConfigured,
  testSMTPConfig,
} from "@/lib/services/email";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const postSchema = z.object({
  // requested DTO: angajatiIds: string[]
  angajatiIds: z.array(z.string().min(1)).min(1).max(500),
  subiect: z.string().min(1).max(200).optional(),
});

export async function POST(request: NextRequest) {
  return withAuditContext(request, async () => {
    const planCheck = await checkPlan(request, FEATURES.PAYROLL_SLIPS, {
      roles: ROLES_PAYROLL,
    });
    if (!planCheck.allowed) return planCheck.response;

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

      if (!(await isSmtpConfigured())) {
        return NextResponse.json(
          {
            error:
              "Serviciul de email nu este configurat (SMTP in Vercel sau Setari email).",
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
          const r = await sendPayslipFluturasById(payslipId, {
            subiect: parsed.data.subiect,
          });
          const payslip = await prisma.payslip.findUnique({
            where: { id: payslipId },
            select: {
              employeeId: true,
              employee: { select: { email: true } },
            },
          });

          detalii.push({
            angajatId: String(payslip?.employeeId ?? payslipId),
            status: "trimis",
            email: String(payslip?.employee.email ?? "").trim(),
            payslipId,
            emailLogId: r.emailLogId,
          });
          void logAudit({
            userId: planCheck.user.userId,
            userEmail: planCheck.user.email,
            action: "PAYSLIP_SENT",
            resource: "Payslip",
            resourceId: payslipId,
            details: { emailLogId: r.emailLogId },
            req: request,
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
