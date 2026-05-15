/**
 * POST /api/email/send
 *
 * Used by Payroll UI ("Trimite email"). Sends payslip via Gmail SMTP (nodemailer).
 * Body: { type: "fluturas", data: { payslipId } } or { angajatiIds, subiect? }
 */

import { withAuditContext } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { sendPayslipFluturasById } from "@/lib/email";
import { ROLES_PAYROLL } from "@/lib/roles";
import { prismaTyped as prisma } from "@/lib/prisma";
import {
  getSMTPConfig,
  isSmtpConfigured,
  testSMTPConfig,
} from "@/lib/services/email";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const postSchema = z.object({
  type: z.literal("fluturas"),
  data: z.object({
    payslipId: z.coerce.number().int().positive().optional(),
    angajatiIds: z.array(z.coerce.number().int().positive()).optional(),
    subiect: z.string().min(1).max(200).optional(),
  }),
});

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

      if (!(await isSmtpConfigured())) {
        return NextResponse.json(
          {
            error:
              "Serviciul de email nu este configurat (SMTP in Vercel sau Setari email).",
          },
          { status: 400 },
        );
      }

      try {
        const cfg = await getSMTPConfig();
        await testSMTPConfig(cfg);
      } catch (e) {
        console.error("[EMAIL_SEND_SMTP]", e);
        return NextResponse.json(
          {
            error:
              "Nu s-a putut conecta la serverul SMTP. Verifica SMTP_USER / SMTP_PASS.",
          },
          { status: 400 },
        );
      }

      const { payslipId, angajatiIds, subiect } = parsed.data.data;

      const payslipIds: number[] = [];
      if (payslipId) payslipIds.push(payslipId);
      if (angajatiIds?.length) payslipIds.push(...angajatiIds);

      const uniqueIds = [...new Set(payslipIds)];
      if (uniqueIds.length === 0) {
        return NextResponse.json(
          { error: "Lipseste payslipId sau angajatiIds" },
          { status: 400 },
        );
      }

      const now = Date.now();
      const oneMinuteAgo = new Date(now - 60_000);
      const sentLastMinute = await prisma.emailLog.count({
        where: {
          createdAt: { gt: oneMinuteAgo },
          templateKey: "PAYSLIP_HTML",
        },
      });
      if (sentLastMinute + uniqueIds.length > 50) {
        return NextResponse.json(
          {
            error:
              "Rate limit: maxim 50 email-uri/minut. Incearca din nou mai tarziu.",
          },
          { status: 429 },
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
          }
      > = [];

      for (const id of uniqueIds) {
        try {
          const r = await sendPayslipFluturasById(id, { subiect });
          const payslip = await prisma.payslip.findUnique({
            where: { id },
            select: {
              employeeId: true,
              employee: { select: { email: true } },
            },
          });
          detalii.push({
            angajatId: String(payslip?.employeeId ?? id),
            status: "trimis",
            email: String(payslip?.employee.email ?? "").trim(),
            payslipId: id,
            emailLogId: r.emailLogId,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          detalii.push({
            angajatId: String(id),
            status: "esuat",
            eroare: msg,
            payslipId: id,
          });
          console.error("[EMAIL_SEND_FLUTURAS]", { payslipId: id }, err);
        }
      }

      const total = uniqueIds.length;
      const trimise = detalii.filter((d) => d.status === "trimis").length;
      const esuate = total - trimise;

      if (total === 1 && trimise === 1) {
        const ok = detalii[0];
        return NextResponse.json({
          success: true,
          message: "Email trimis",
          emailLogId:
            ok && ok.status === "trimis" ? ok.emailLogId : undefined,
        });
      }

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
      console.error("[EMAIL_SEND_FATAL]", e);
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "Trimiterea emailului a esuat";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  });
}
