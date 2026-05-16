import "server-only";

import { logAuditFF } from "@/lib/audit";
import { sendTransactionalEmail } from "@/lib/mail/transactional";
import { prismaTyped as prisma } from "@/lib/prisma";
import { buildPayslipPdfBufferForEmail } from "@/lib/services/payslipPdf";

type Attachment = { filename: string; content: Buffer; contentType: string };

function toArray(to: string | string[]): string[] {
  return (Array.isArray(to) ? to : [to])
    .map((s) => String(s ?? "").trim())
    .filter(Boolean);
}

function stripHtml(html: string): string {
  return String(html ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseMonthYearFromRoDate(
  dateStr: string,
): { monthName: string; year: string } | null {
  const m = String(dateStr ?? "")
    .trim()
    .match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const month = Number(m[2]);
  const year = String(m[3]);
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  const d = new Date(Date.UTC(Number(year), month - 1, 2));
  const monthName = new Intl.DateTimeFormat("ro-RO", { month: "long" }).format(
    d,
  );
  return { monthName, year };
}

/** Normalizează afișarea perioadei la DD.MM.YYYY pentru corpul emailului. */
function normalizeDdMmYyyy(raw: string): string {
  const s = String(raw ?? "").trim();
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s;
  const loose = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (loose) {
    const dd = String(loose[1]).padStart(2, "0");
    const mm = String(loose[2]).padStart(2, "0");
    return `${dd}.${mm}.${loose[3]}`;
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    return `${dd}.${mm}.${yyyy}`;
  }
  return s;
}

function buildBaseEmailHtml(args: {
  title: string;
  subtitle?: string;
  greeting?: string;
  bodyHtml: string; // already escaped or trusted HTML
  primaryCta?: { label: string; href: string };
  footerText?: string;
}): string {
  const title = escapeHtml(args.title);
  const subtitle = escapeHtml(args.subtitle ?? "");
  const greeting = escapeHtml(args.greeting ?? "");
  const footerText = escapeHtml(
    args.footerText ?? "Acest mesaj a fost trimis automat.",
  );
  const ctaLabel = escapeHtml(args.primaryCta?.label ?? "");
  const ctaHref = String(args.primaryCta?.href ?? "").trim();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:20px;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:18px 20px;border-bottom:2px solid #0d6efd;background:#f8f9fa;">
              <div style="font-size:18px;font-weight:800;color:#111827;">${title}</div>
              ${subtitle ? `<div style="margin-top:6px;font-size:13px;color:#6b7280;">${subtitle}</div>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 20px;">
              ${greeting ? `<div style="font-size:14px;color:#111827;margin-bottom:10px;">${greeting}</div>` : ""}
              <div style="font-size:14px;color:#111827;line-height:20px;">${args.bodyHtml}</div>
              ${
                ctaHref && ctaLabel
                  ? `<div style="margin-top:16px;">
                       <a href="${escapeHtml(ctaHref)}" target="_blank" rel="noreferrer"
                          style="display:inline-block;background:#0d6efd;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:6px;font-size:14px;font-weight:700;">
                         ${ctaLabel}
                       </a>
                     </div>`
                  : ""
              }
            </td>
          </tr>
          <tr>
            <td style="padding:14px 20px;border-top:1px solid #e5e7eb;background:#ffffff;">
              <div style="font-size:12px;color:#6b7280;line-height:16px;">${footerText}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function fmtDateRo(d: string): string {
  return String(d ?? "").trim();
}

function fmtMoney(amount: number, currency: string): string {
  const v = Number(amount);
  const n = Number.isFinite(v) ? v : 0;
  const cur =
    String(currency ?? "")
      .trim()
      .toUpperCase() || "EUR";
  return `${n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
}

/** Valori monetare pentru corpul emailului fluturaș (PDF-style): zecimale RO + € dacă moneda e EUR. */
function fmtFluturasMoney(amount: number, moneda: string): string {
  const v = Number(amount);
  const n = Number.isFinite(v) ? v : 0;
  const m =
    String(moneda ?? "EUR")
      .trim()
      .toUpperCase() || "EUR";
  const num = n.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (m === "EUR") return `${num} \u20ac`;
  return `${num} ${m}`;
}

function fmtFluturasHours(ore: number): string {
  const v = Number(ore);
  const n = Number.isFinite(v) ? v : 0;
  return n.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Etichete RO pentru tipuri PayslipItem (schema Prisma). */
export function payslipItemTypeRo(type: string): string {
  const m: Record<string, string> = {
    NET_SALARY: "Salariu net",
    TRAVEL_ALLOWANCE: "Diurnă",
    HOLIDAY_MONEY: "Holiday money",
    OVERTIME: "Ore suplimentare",
    BONUS: "Bonus",
    DEDUCTION: "Deducere",
    OTHER: "Altele",
  };
  const k = String(type ?? "").trim();
  return m[k] ?? (k || "Linie");
}

export type EmailBodyData = {
  angajatNume: string;
  /** Empl. ID (afișat ca text). */
  employeeId?: string;
  saptamana: number;
  an: number;
  oreLucrate: number;
  /** „Salary for worked hours” (PDF). */
  salariuOreLucrate: number;
  salariuNet: number;
  diurna: number;
  totalPlatit: number;
  holidayMoney: number;
  moneda: string;
  pozitie?: string;
  perioadaStart?: string;
  perioadaEnd?: string;
  companyName?: string;
  companyAddress?: string;
};

/**
 * Corp HTML fluturaș — replica vizuală a PDF-ului (tabele, inline styles), fără titlu/salut în body.
 */
export function generateEmailBody(data: EmailBodyData): string {
  const moneda =
    String(data.moneda ?? "EUR")
      .trim()
      .toUpperCase() || "EUR";
  const n = (x: unknown) => {
    const v = Number(x);
    return Number.isFinite(v) ? v : 0;
  };
  const oreLucrate = n(data.oreLucrate);
  const salariuOreLucrate = n(data.salariuOreLucrate);
  const salariuNet = n(data.salariuNet);
  const diurna = n(data.diurna);
  const totalPlatit = n(data.totalPlatit);
  const holidayMoney = n(data.holidayMoney);
  const saptamana = Math.trunc(n(data.saptamana));
  const an = Math.trunc(n(data.an));

  const companyNameRaw = String(data.companyName ?? "").trim();
  const companyAddrRaw = String(data.companyAddress ?? "").trim();
  const employerNameEsc = escapeHtml(companyNameRaw || "Cedol Autocraft SRL");
  const addrEsc = escapeHtml(
    companyAddrRaw || "Iasi, Str. Pacurari nr. 159a, Jud. Iasi",
  );

  const nameEsc = escapeHtml(String(data.angajatNume ?? "").trim());
  const emplIdEsc = escapeHtml(String(data.employeeId ?? "").trim());
  const posEsc = escapeHtml(String(data.pozitie ?? "").trim());

  const dStart = normalizeDdMmYyyy(String(data.perioadaStart ?? ""));
  const dEnd = normalizeDdMmYyyy(String(data.perioadaEnd ?? ""));
  const periodLineEsc =
    dStart && dEnd
      ? `${escapeHtml(dStart)}\u2014 ${escapeHtml(dEnd)}`
      : dStart
        ? escapeHtml(dStart)
        : "";

  const hoursStr = fmtFluturasHours(oreLucrate);
  const salHourStr = fmtFluturasMoney(salariuOreLucrate, moneda);
  const netStr = fmtFluturasMoney(salariuNet, moneda);
  const travelStr = fmtFluturasMoney(diurna, moneda);
  const totalStr = fmtFluturasMoney(totalPlatit, moneda);
  const holidayStr = fmtFluturasMoney(holidayMoney, moneda);

  const ff = "Arial,Helvetica,sans-serif";
  const lbl = `color:#666666;font-size:12px;font-family:${ff};`;
  const valBold = `color:#000000;font-weight:bold;font-size:14px;font-family:${ff};`;
  const valBody = `color:#212121;font-size:14px;font-family:${ff};`;
  const numBig = `color:#000000;font-weight:bold;font-size:20px;font-family:${ff};`;
  const sep = "border-bottom:2px solid #1a73e8;";
  const pad = "padding:16px 20px;";

  const disclaimer =
    "These are your net earnings for this week. Gross income, contributions and taxes are available only at month level in the monthly payslips.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Payslip</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;-webkit-text-size-adjust:100%;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#f5f5f5;mso-table-lspace:0pt;mso-table-rspace:0pt;">
  <tr>
    <td align="center" style="padding:12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;border-collapse:collapse;background:#ffffff;border:1px solid #e0e0e0;font-family:${ff};">
        <tr>
          <td style="background-color:#E8F0FE;${pad}${sep}">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
              <tr>
                <td style="${lbl}">Employer</td>
              </tr>
              <tr>
                <td style="font-size:18px;font-weight:bold;color:#1a73e8;padding-top:6px;font-family:${ff};">${employerNameEsc}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#212121;padding-top:8px;line-height:1.45;font-family:${ff};">${addrEsc}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;${pad}${sep}">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
              <tr>
                <td valign="top" width="50%" style="width:50%;padding-right:12px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
                    <tr>
                      <td style="${lbl}">Name:</td>
                    </tr>
                    <tr>
                      <td style="${valBold};padding-top:4px;">${nameEsc}</td>
                    </tr>
                    <tr>
                      <td style="height:12px;line-height:12px;font-size:0;">&nbsp;</td>
                    </tr>
                    <tr>
                      <td style="${lbl}">Empl. ID:</td>
                    </tr>
                    <tr>
                      <td style="${valBold};padding-top:4px;">${emplIdEsc || "—"}</td>
                    </tr>
                    <tr>
                      <td style="height:12px;line-height:12px;font-size:0;">&nbsp;</td>
                    </tr>
                    <tr>
                      <td style="${lbl}">Position:</td>
                    </tr>
                    <tr>
                      <td style="${valBody};padding-top:4px;">${posEsc || "—"}</td>
                    </tr>
                  </table>
                </td>
                <td valign="top" width="50%" align="right" style="width:50%;padding-left:12px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="border-collapse:collapse;">
                    <tr>
                      <td align="right" style="${lbl}">Week:</td>
                      <td style="padding-left:12px;" align="right"><span style="${numBig}">${saptamana}</span></td>
                    </tr>
                    <tr>
                      <td align="right" style="${lbl};padding-top:8px;">Year:</td>
                      <td style="padding-left:12px;padding-top:8px;" align="right"><span style="${numBig}">${an}</span></td>
                    </tr>
                  </table>
                  ${
                    periodLineEsc
                      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" width="100%" style="border-collapse:collapse;margin-top:14px;"><tr><td align="right" style="font-size:13px;color:#212121;font-family:${ff};">${periodLineEsc}</td></tr></table>`
                      : ""
                  }
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;${pad}${sep}">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
              <tr>
                <td valign="top" width="50%" style="width:50%;padding-right:12px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
                    <tr>
                      <td style="${lbl}">Hours worked this week:</td>
                    </tr>
                    <tr>
                      <td style="${valBold};padding-top:6px;">${hoursStr}</td>
                    </tr>
                    <tr>
                      <td style="height:14px;line-height:14px;font-size:0;">&nbsp;</td>
                    </tr>
                    <tr>
                      <td style="${lbl}">Salary for worked hours:</td>
                    </tr>
                    <tr>
                      <td style="${valBold};padding-top:6px;">${salHourStr}</td>
                    </tr>
                  </table>
                </td>
                <td valign="top" width="50%" align="right" style="width:50%;padding-left:12px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="border-collapse:collapse;">
                    <tr>
                      <td align="right" valign="top" style="${lbl}">Net Salary EUR</td>
                      <td align="right" valign="top" style="padding-left:12px;"><span style="${valBold}">${netStr}</span></td>
                    </tr>
                    <tr>
                      <td colspan="2" align="right" style="padding-top:14px;">
                        <span style="${lbl}">Travel allowance</span><br />
                        <span style="${valBold};padding-top:4px;display:inline-block;">${travelStr}</span>
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding-top:14px;border-top:2px solid #1a73e8;line-height:1;font-size:0;">&nbsp;</td>
                    </tr>
                    <tr>
                      <td align="right" style="${lbl};padding-top:10px;">Total paid</td>
                      <td align="right" style="padding-left:12px;padding-top:10px;"><span style="font-size:18px;font-weight:bold;color:#1a73e8;font-family:${ff};">${totalStr}</span></td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;${pad}${sep}">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
              <tr>
                <td style="${lbl}">Holiday money earned:</td>
                <td align="right" style="${valBold}">${holidayStr}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:0 20px 20px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background-color:#FCE4EC;border:1px solid #F8BBD0;">
              <tr>
                <td style="padding:14px 16px;font-size:12px;line-height:1.5;color:#C62828;font-family:${ff};">${escapeHtml(disclaimer)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export async function sendEmail({
  to,
  subject,
  html,
  attachments,
  templateKey,
  toName,
}: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Attachment[];
  templateKey?: string;
  toName?: string | null;
}): Promise<{ success: true; messageIds: string[]; emailLogIds: number[] }> {
  const recipients = toArray(to);
  if (recipients.length === 0) throw new Error("Recipient missing");
  if (!String(subject ?? "").trim()) throw new Error("Subject missing");

  const safeHtml = String(html ?? "");
  const text = stripHtml(safeHtml) || safeHtml;

  const emailLogIds: number[] = [];
  const messageIds: string[] = [];

  for (const toAddress of recipients) {
    const emailLog = await prisma.emailLog.create({
      data: {
        toAddress,
        toName: toName ?? null,
        subject: String(subject),
        body: safeHtml,
        templateKey: templateKey ?? "GENERIC",
        status: "SENDING",
        sentAt: null,
        errorMessage: null,
        retryCount: 0,
      },
      select: { id: true },
    });
    emailLogIds.push(emailLog.id);

    try {
      if (attachments?.length) {
        const { getSMTPConfig, testSMTPConfig } = await import(
          "@/lib/services/email"
        );
        const nodemailer = await import("nodemailer");
        const cfg = await getSMTPConfig();
        console.log("[EMAIL] Attachments via SMTP:", cfg.host);
        await testSMTPConfig(cfg);
        const transporter = nodemailer.default.createTransport({
          host: cfg.host,
          port: cfg.port,
          secure: cfg.secure,
          auth: { user: cfg.user, pass: cfg.pass },
        });
        const info = await transporter.sendMail({
          from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
          to: toAddress,
          subject: String(subject),
          html: safeHtml,
          text,
          attachments: attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
          })),
        });
        const mid = String(info.messageId ?? "").trim();
        if (!mid) throw new Error("SMTP attachment send: no messageId");
        messageIds.push(mid);
      } else {
        console.log("[EMAIL] Sending to:", toAddress);
        const sent = await sendTransactionalEmail({
          to: toAddress,
          subject: String(subject),
          html: safeHtml,
          text,
        });
        console.log("[EMAIL] Provider:", sent.provider, "id:", sent.messageId);
        messageIds.push(sent.messageId);
      }

      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { status: "SENT", sentAt: new Date(), errorMessage: null },
      });

      logAuditFF({
        action: "UPDATE",
        entity: "System",
        details: "EMAIL_SENT",
        newValues: { to: toAddress, subject: String(subject) },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { status: "FAILED", sentAt: null, errorMessage: msg },
      });

      logAuditFF({
        action: "UPDATE",
        entity: "System",
        details: "EMAIL_FAILED",
        newValues: { to: toAddress, subject: String(subject), error: msg },
      });

      throw new Error(`Email send failed: ${msg}`);
    }
  }

  return { success: true, messageIds, emailLogIds };
}

export type SendFluturasParams = {
  /** When set, attaches the payslip PDF (generated or loaded from disk). */
  payslipId?: number;
  /** Recipient (preferred). */
  to?: string;
  /** @deprecated Prefer `to` — kept for existing callers. */
  angajatEmail?: string;
  angajatNume: string;
  /** Optional metadata (routes may omit). */
  angajatId?: string;
  pozitie?: string;
  saptamana: number;
  an: number;
  /** Used for `{luna}` in subject template when form subject is empty. */
  perioadaStart?: string;
  perioadaEnd?: string;
  oreLucrate: number;
  salariuOreLucrate?: number;
  salariuNet: number;
  diurna: number;
  totalPlatit: number;
  holidayMoney: number;
  moneda: string;
  subject?: string;
  subiect?: string;
  numeFirma?: string;
  adresaFirma?: string;
};

export async function sendFluturasEmail(
  args: SendFluturasParams,
): Promise<{ success: true; emailLogId: number; messageIds: string[] }> {
  const toAddress = String(args.to ?? args.angajatEmail ?? "").trim();
  if (!toAddress)
    throw new Error("Recipient missing (use `to` or `angajatEmail`)");

  const emailSettings = await prisma.emailSettings.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
    select: { subjectTemplate: true },
  });

  const m = parseMonthYearFromRoDate(args.perioadaStart ?? "");
  const vars = { luna: m?.monthName ?? "", an: String(args.an) };
  const explicitSubject = String(args.subject ?? args.subiect ?? "").trim();
  const defaultWeekSubject = `Fluturas salariu - Saptamana ${args.saptamana}/${args.an}`;
  const emailSubject =
    explicitSubject ||
    (emailSettings?.subjectTemplate
      ? emailSettings.subjectTemplate
          .replaceAll("{luna}", vars.luna)
          .replaceAll("{an}", vars.an)
      : defaultWeekSubject);

  const cur =
    String(args.moneda ?? "EUR")
      .trim()
      .toUpperCase() || "EUR";

  try {
    const fullHtml = generateEmailBody({
      angajatNume: String(args.angajatNume ?? "").trim(),
      employeeId: args.angajatId ? String(args.angajatId).trim() : undefined,
      saptamana: Number(args.saptamana),
      an: Number(args.an),
      oreLucrate: Number(args.oreLucrate),
      salariuOreLucrate: Number(args.salariuOreLucrate ?? args.salariuNet),
      salariuNet: Number(args.salariuNet),
      diurna: Number(args.diurna),
      totalPlatit: Number(args.totalPlatit),
      holidayMoney: Number(args.holidayMoney),
      moneda: cur,
      pozitie: args.pozitie ? String(args.pozitie).trim() : undefined,
      perioadaStart: args.perioadaStart
        ? String(args.perioadaStart).trim()
        : undefined,
      perioadaEnd: args.perioadaEnd
        ? String(args.perioadaEnd).trim()
        : undefined,
      companyName: args.numeFirma ? String(args.numeFirma).trim() : undefined,
      companyAddress: args.adresaFirma
        ? String(args.adresaFirma).trim()
        : undefined,
    });

    let attachments: Attachment[] | undefined;
    if (args.payslipId != null && Number.isFinite(args.payslipId) && args.payslipId > 0) {
      const pdf = await buildPayslipPdfBufferForEmail(args.payslipId);
      attachments = [
        {
          filename: pdf.fileName,
          content: pdf.buffer,
          contentType: "application/pdf",
        },
      ];
    }

    const r = await sendEmail({
      to: toAddress,
      subject: emailSubject || defaultWeekSubject,
      html: fullHtml,
      attachments,
      templateKey: "PAYSLIP_HTML",
      toName: String(args.angajatNume ?? "").trim() || null,
    });

    logAuditFF({
      action: "UPDATE",
      entity: "System",
      details: "PAYSLIP_EMAIL_SENT",
      newValues: {
        to: toAddress,
        subject: String(emailSubject),
        week: args.saptamana,
        year: args.an,
      },
    });

    return {
      success: true,
      emailLogId: r.emailLogIds[0] ?? 0,
      messageIds: r.messageIds,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (process.env.NODE_ENV === "development") {
      console.error("[sendFluturasEmail] failed", args.angajatNume, msg);
    }
    throw error;
  }
}

function formatRoDateForPayslip(d: Date | string): string {
  const dt = d instanceof Date ? d : new Date(String(d));
  if (Number.isNaN(dt.getTime())) return "";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = String(dt.getFullYear());
  return `${dd}.${mm}.${yyyy}`;
}

/** Load payslip from DB, send HTML + PDF via Gmail SMTP, mark emailSent. */
export async function sendPayslipFluturasById(
  payslipId: number,
  options?: { subiect?: string },
): Promise<{ success: true; emailLogId: number; messageIds: string[] }> {
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

  if (!payslip) throw new Error("Fluturas inexistent");

  const toAddress = (payslip.employee.email ?? "").trim();
  if (!toAddress) throw new Error("Angajatul nu are email setat");

  const currency = String(payslip.currency ?? "EUR").toUpperCase();
  const netSalary =
    payslip.items.find((i) => i.type === "NET_SALARY")?.amount ?? 0;
  const travel =
    payslip.items.find((i) => i.type === "TRAVEL_ALLOWANCE")?.amount ?? 0;
  const holiday =
    payslip.items.find((i) => i.type === "HOLIDAY_MONEY")?.amount ?? 0;

  const r = await sendFluturasEmail({
    payslipId: payslip.id,
    angajatEmail: toAddress,
    angajatNume:
      `${String(payslip.employee.lastName ?? "").trim()} ${String(
        payslip.employee.firstName ?? "",
      ).trim()}`.trim(),
    angajatId: String(payslip.employeeId),
    pozitie: String(payslip.employee.position ?? "").trim(),
    saptamana: payslip.weekNumber,
    an: payslip.year,
    perioadaStart: formatRoDateForPayslip(payslip.periodStart),
    perioadaEnd: formatRoDateForPayslip(payslip.periodEnd),
    oreLucrate: Number(String(payslip.timesheet.hoursWorked)),
    salariuOreLucrate: Number(String(netSalary)),
    salariuNet: Number(String(netSalary)),
    diurna: Number(String(travel)),
    totalPlatit: Number(String(payslip.totalPaid)),
    holidayMoney: Number(String(holiday)),
    moneda: currency,
    subiect: options?.subiect,
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

  return r;
}

// 2. Contract nou angajat
export async function sendContractEmail(args: {
  to: string | string[];
  angajatNume: string;
  contractUrl: string;
  dataStart: string;
  pdfBuffer?: Buffer;
}) {
  const bodyHtml = [
    `<div>Salut ${escapeHtml(args.angajatNume)},</div>`,
    `<div style="margin-top:10px;">Contractul tau este pregatit. Data start: <strong>${escapeHtml(
      fmtDateRo(args.dataStart),
    )}</strong>.</div>`,
    `<div style="margin-top:10px;">Poti deschide contractul folosind butonul de mai jos.</div>`,
  ].join("");

  const html = buildBaseEmailHtml({
    title: "Contract nou angajat",
    subtitle: "Semnare si detalii contract",
    greeting: "",
    bodyHtml,
    primaryCta: { label: "Vezi contractul", href: args.contractUrl },
  });

  const attachments: Attachment[] | undefined =
    args.pdfBuffer && args.pdfBuffer.length > 0
      ? [
          {
            filename: "Contract.pdf",
            content: args.pdfBuffer,
            contentType: "application/pdf",
          },
        ]
      : undefined;

  return await sendEmail({
    to: args.to,
    subject: "Contract nou - actiune necesara",
    html,
    attachments,
    templateKey: "CONTRACT",
    toName: String(args.angajatNume ?? "").trim() || null,
  });
}

// 3. Notificare document expirat / expira
export async function sendDocumentExpiryEmail(args: {
  to: string | string[];
  angajatNume: string;
  tipDocument: string;
  dataExpirare: string;
  zileRamase: number;
  uploadUrl?: string;
}) {
  const days = Number.isFinite(Number(args.zileRamase))
    ? Number(args.zileRamase)
    : 0;
  const bodyHtml = [
    `<div>Salut ${escapeHtml(args.angajatNume)},</div>`,
    `<div style="margin-top:10px;">Documentul <strong>${escapeHtml(args.tipDocument)}</strong> expira in <strong>${escapeHtml(
      String(days),
    )}</strong> zile.</div>`,
    `<div style="margin-top:6px;">Data expirare: <strong>${escapeHtml(fmtDateRo(args.dataExpirare))}</strong></div>`,
    `<div style="margin-top:10px;">Te rugam sa incarci un document nou cat mai curand.</div>`,
  ].join("");

  const html = buildBaseEmailHtml({
    title: "Notificare document",
    subtitle: "Document expira",
    bodyHtml,
    primaryCta: args.uploadUrl
      ? { label: "Incarca document nou", href: args.uploadUrl }
      : undefined,
  });

  return await sendEmail({
    to: args.to,
    subject: `Document expira: ${String(args.tipDocument ?? "").trim() || "Document"}`,
    html,
    templateKey: "DOC_EXPIRY",
    toName: String(args.angajatNume ?? "").trim() || null,
  });
}

// 4. Pontaj aprobat/respins
export async function sendPontajStatusEmail(args: {
  to: string | string[];
  angajatNume: string;
  saptamana: number;
  status: "aprobat" | "respins";
  motivRespingere?: string;
  oreAprobate?: number;
  pontajUrl?: string;
}) {
  const isOk = args.status === "aprobat";
  const badgeBg = isOk ? "#dcfce7" : "#fee2e2";
  const badgeText = isOk ? "#166534" : "#991b1b";
  const statusLabel = isOk ? "APROBAT" : "RESPINS";

  const bodyHtml = [
    `<div>Salut ${escapeHtml(args.angajatNume)},</div>`,
    `<div style="margin-top:10px;">Pontajul pentru saptamana <strong>${escapeHtml(
      String(args.saptamana),
    )}</strong> a fost:</div>`,
    `<div style="margin-top:10px;">
      <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:${badgeBg};color:${badgeText};font-weight:800;font-size:12px;">
        ${escapeHtml(statusLabel)}
      </span>
    </div>`,
    args.oreAprobate != null
      ? `<div style="margin-top:10px;">Ore aprobate: <strong>${escapeHtml(String(args.oreAprobate))}</strong></div>`
      : "",
    !isOk && args.motivRespingere
      ? `<div style="margin-top:10px;">Motiv respingere: <strong>${escapeHtml(args.motivRespingere)}</strong></div>`
      : "",
  ].join("");

  const html = buildBaseEmailHtml({
    title: "Status pontaj",
    subtitle: "Notificare pontaj",
    bodyHtml,
    primaryCta: args.pontajUrl
      ? { label: "Vezi pontajul", href: args.pontajUrl }
      : undefined,
  });

  return await sendEmail({
    to: args.to,
    subject: `Pontaj ${statusLabel} - Saptamana ${args.saptamana}`,
    html,
    templateKey: isOk ? "TIMESHEET_APPROVED" : "TIMESHEET_REJECTED",
    toName: String(args.angajatNume ?? "").trim() || null,
  });
}

// 5. Plata procesata
export async function sendPlataEmail(args: {
  to: string | string[];
  angajatNume: string;
  suma: number;
  moneda: string;
  perioada: string;
  pdfBuffer?: Buffer;
}) {
  const bodyHtml = [
    `<div>Salut ${escapeHtml(args.angajatNume)},</div>`,
    `<div style="margin-top:10px;">Plata a fost procesata pentru perioada <strong>${escapeHtml(
      String(args.perioada ?? "").trim(),
    )}</strong>.</div>`,
    `<div style="margin-top:10px;">Suma: <strong>${escapeHtml(fmtMoney(args.suma, args.moneda))}</strong></div>`,
    args.pdfBuffer
      ? `<div style="margin-top:10px;">Detaliile sunt atasate in PDF.</div>`
      : "",
  ].join("");

  const html = buildBaseEmailHtml({
    title: "Plata procesata",
    subtitle: "Confirmare plata",
    bodyHtml,
  });

  const attachments: Attachment[] | undefined =
    args.pdfBuffer && args.pdfBuffer.length > 0
      ? [
          {
            filename: "Plata.pdf",
            content: args.pdfBuffer,
            contentType: "application/pdf",
          },
        ]
      : undefined;

  return await sendEmail({
    to: args.to,
    subject: `Plata procesata - ${String(args.perioada ?? "").trim() || "Perioada"}`,
    html,
    attachments,
    templateKey: "PAYMENT",
    toName: String(args.angajatNume ?? "").trim() || null,
  });
}

// 6. Raport
export async function sendRaportEmail(args: {
  to: string | string[];
  subiect: string;
  tipRaport: string;
  perioada: string;
  pdfBuffer?: Buffer;
  excelBuffer?: Buffer;
}) {
  const bodyHtml = [
    `<div>Raportul pentru perioada <strong>${escapeHtml(String(args.perioada ?? "").trim())}</strong> este atasat.</div>`,
    `<div style="margin-top:8px;">Tip raport: <strong>${escapeHtml(String(args.tipRaport ?? "").trim())}</strong></div>`,
  ].join("");

  const html = buildBaseEmailHtml({
    title: "Raport",
    subtitle: "Transmitere raport pe email",
    bodyHtml,
  });

  const attachments: Attachment[] = [];
  if (args.pdfBuffer && args.pdfBuffer.length > 0) {
    attachments.push({
      filename: "Raport.pdf",
      content: args.pdfBuffer,
      contentType: "application/pdf",
    });
  }
  if (args.excelBuffer && args.excelBuffer.length > 0) {
    attachments.push({
      filename: "Raport.xlsx",
      content: args.excelBuffer,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  return await sendEmail({
    to: args.to,
    subject: String(args.subiect ?? "").trim() || "Raport",
    html,
    attachments: attachments.length ? attachments : undefined,
    templateKey: "REPORT",
  });
}

// 7. Invitatie utilizator nou
export async function sendInvitatieEmail(args: {
  to: string | string[];
  nume: string;
  rol: string;
  linkActivare: string;
  expirareLink: string; // "YYYY-MM-DD" or human string
}) {
  const bodyHtml = [
    `<div>Salut ${escapeHtml(args.nume)},</div>`,
    `<div style="margin-top:10px;">Ai fost invitat in platforma HR Management.</div>`,
    `<div style="margin-top:8px;">Rol: <strong>${escapeHtml(String(args.rol ?? "").trim())}</strong></div>`,
    `<div style="margin-top:8px;">Linkul expira la: <strong>${escapeHtml(String(args.expirareLink ?? "").trim())}</strong></div>`,
  ].join("");

  const html = buildBaseEmailHtml({
    title: "Invitatie cont nou",
    subtitle: "Activeaza contul",
    bodyHtml,
    primaryCta: { label: "Activeaza contul", href: args.linkActivare },
  });

  return await sendEmail({
    to: args.to,
    subject: "Invitatie - Activeaza contul",
    html,
    templateKey: "INVITE",
    toName: String(args.nume ?? "").trim() || null,
  });
}

// 8. Notificare detasare
export async function sendDetasareEmail(args: {
  to: string | string[];
  angajatNume: string;
  tara: string;
  oras: string;
  dataStart: string;
  dataEnd?: string;
  detaliiCazare?: string;
  detasareUrl?: string;
}) {
  const bodyHtml = [
    `<div>Salut ${escapeHtml(args.angajatNume)},</div>`,
    `<div style="margin-top:10px;">Ai o detasare noua.</div>`,
    `<div style="margin-top:8px;">Locatie: <strong>${escapeHtml(String(args.tara ?? "").trim())}</strong>, <strong>${escapeHtml(
      String(args.oras ?? "").trim(),
    )}</strong></div>`,
    `<div style="margin-top:8px;">Perioada: <strong>${escapeHtml(fmtDateRo(args.dataStart))}</strong>${
      args.dataEnd
        ? ` - <strong>${escapeHtml(fmtDateRo(args.dataEnd))}</strong>`
        : ""
    }</div>`,
    args.detaliiCazare
      ? `<div style="margin-top:10px;">Cazare: <strong>${escapeHtml(String(args.detaliiCazare))}</strong></div>`
      : "",
  ].join("");

  const html = buildBaseEmailHtml({
    title: "Detasare noua",
    subtitle: "Detalii detasare",
    bodyHtml,
    primaryCta: args.detasareUrl
      ? { label: "Vezi detalii", href: args.detasareUrl }
      : undefined,
  });

  return await sendEmail({
    to: args.to,
    subject: "Detasare noua - informatii",
    html,
    templateKey: "DEPLOYMENT",
    toName: String(args.angajatNume ?? "").trim() || null,
  });
}
