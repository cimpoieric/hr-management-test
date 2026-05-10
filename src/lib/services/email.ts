import "server-only";

import nodemailer from "nodemailer";
import { prismaTyped as prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { generatePayslipPdf } from "@/lib/services/payslipPdf";

export type EmailSettingsRow = {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
  updatedAt: Date;
};

export async function getEmailSettings(): Promise<EmailSettingsRow | null> {
  const row = await prisma.emailSettings.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  return (row as unknown as EmailSettingsRow) ?? null;
}

export type SMTPConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
};

const SMTP_KEYS = {
  host: "smtp.host",
  port: "smtp.port",
  user: "smtp.user",
  pass: "smtp.pass",
  fromEmail: "smtp.fromEmail",
  fromName: "smtp.fromName",
  secure: "smtp.secure",
} as const;

function pick(records: Array<{ key: string; value: string }>, key: string): string | undefined {
  return records.find((r) => r.key === key)?.value;
}

function decryptSafe(value: string): string {
  // parola poate fi stocată fie în plaintext, fie criptată cu ENCRYPTION_KEY
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

export async function getSMTPConfig(): Promise<SMTPConfig> {
  // Prefer EmailSettings table (new), fallback to legacy SystemConfig.
  const row = await prisma.emailSettings.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
    select: {
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      smtpPass: true,
      fromEmail: true,
      fromName: true,
    },
  });

  if (row) {
    const host = (row.smtpHost ?? "").trim();
    const port = Number(row.smtpPort);
    const user = (row.smtpUser ?? "").trim();
    const pass = row.smtpPass ? decryptSafe(String(row.smtpPass).trim()) : "";
    const fromEmail = (row.fromEmail ?? user ?? "").trim();
    const fromName = (row.fromName ?? "HR Management").trim();
    const secure = port === 465;

    if (!host) throw new Error("SMTP host missing (EmailSettings.smtpHost)");
    if (!Number.isFinite(port) || port <= 0) throw new Error("SMTP port invalid (EmailSettings.smtpPort)");
    if (!user) throw new Error("SMTP user missing (EmailSettings.smtpUser)");
    if (!pass) throw new Error("SMTP pass missing (EmailSettings.smtpPass)");
    if (!fromEmail) throw new Error("SMTP fromEmail missing (EmailSettings.fromEmail)");

    return { host, port, secure, user, pass, fromEmail, fromName };
  }

  const keys = Object.values(SMTP_KEYS);
  const records = await prisma.systemConfig.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  });

  const host = (pick(records, SMTP_KEYS.host) ?? "").trim();
  const portRaw = (pick(records, SMTP_KEYS.port) ?? "587").trim();
  const user = (pick(records, SMTP_KEYS.user) ?? "").trim();
  const passRaw = (pick(records, SMTP_KEYS.pass) ?? "").trim();
  const fromEmail = (pick(records, SMTP_KEYS.fromEmail) ?? user ?? "").trim();
  const fromName = (pick(records, SMTP_KEYS.fromName) ?? "HR Management").trim();
  const secureRaw = (pick(records, SMTP_KEYS.secure) ?? "false").trim();

  const port = Number(portRaw);
  const secure = secureRaw === "true" || secureRaw === "1";
  const pass = passRaw ? decryptSafe(passRaw) : "";

  if (!host) throw new Error("SMTP host missing (SystemConfig: smtp.host)");
  if (!Number.isFinite(port) || port <= 0) throw new Error("SMTP port invalid (SystemConfig: smtp.port)");
  if (!user) throw new Error("SMTP user missing (SystemConfig: smtp.user)");
  if (!pass) throw new Error("SMTP pass missing (SystemConfig: smtp.pass)");
  if (!fromEmail) throw new Error("SMTP fromEmail missing (SystemConfig: smtp.fromEmail)");

  return { host, port, secure, user, pass, fromEmail, fromName };
}

export async function testSMTPConfig(config: SMTPConfig): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
  await transporter.verify();
}

export type SendPayslipEmailArgs = {
  payslipId: number;
  toEmail?: string;
};

function money(n: unknown, currency: string): string {
  const v = typeof n === "object" && n !== null && "toString" in n ? Number(String(n)) : Number(n);
  const value = Number.isFinite(v) ? v : 0;
  return `${value.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export async function sendPayslipEmail(args: SendPayslipEmailArgs): Promise<{
  success: true;
  emailLogId: number;
}> {
  const payslip = await prisma.payslip.findUnique({
    where: { id: args.payslipId },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, email: true } },
      company: { select: { id: true, name: true, address: true } },
      timesheet: { select: { id: true, hoursWorked: true, status: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!payslip) throw new Error("Payslip not found");

  const toAddress = (args.toEmail ?? payslip.employee.email ?? "").trim();
  if (!toAddress) throw new Error("Destinatar lipsă (employee.email sau toEmail)");

  const cfg = await getSMTPConfig();
  await testSMTPConfig(cfg);

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const pdf = await generatePayslipPdf(payslip.id);

  const currency = (payslip.currency || "EUR").toUpperCase();
  const netSalary = payslip.items.find((i) => i.type === "NET_SALARY")?.amount ?? 0;
  const travel = payslip.items.find((i) => i.type === "TRAVEL_ALLOWANCE")?.amount ?? 0;
  const holiday = payslip.items.find((i) => i.type === "HOLIDAY_MONEY")?.amount ?? 0;

  const subject = `Fluturaș salariu - Săptămâna ${payslip.weekNumber}/${payslip.year}`;
  const bodyText =
    `Bună,\n\n` +
    `Atașat găsești fluturașul de salariu pentru săptămâna ${payslip.weekNumber}/${payslip.year}.\n\n` +
    `Ore lucrate: ${String(payslip.timesheet.hoursWorked)}\n` +
    `Salariu net: ${money(netSalary, currency)}\n` +
    `Travel allowance: ${money(travel, currency)}\n` +
    `Holiday money: ${money(holiday, currency)}\n` +
    `Total plătit: ${money(payslip.totalPaid, currency)}\n\n` +
    `O zi bună,\n${cfg.fromName}\n`;

  // EmailLog (QUEUED → SENT/FAILED)
  const emailLog = await prisma.emailLog.create({
    data: {
      toAddress,
      toName: `${payslip.employee.firstName} ${payslip.employee.lastName}`.trim() || null,
      employeeId: payslip.employeeId,
      subject,
      body: bodyText,
      templateKey: "PAYSLIP",
      attachmentPath: pdf.relativePath,
      attachmentName: pdf.fileName,
      status: "SENDING",
      sentAt: null,
      errorMessage: null,
      retryCount: 0,
    },
    select: { id: true },
  });

  try {
    const info = await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: toAddress,
      subject,
      text: bodyText,
      attachments: [
        {
          filename: pdf.fileName,
          content: Buffer.from(pdf.pdfBytes),
          contentType: "application/pdf",
        },
      ],
    });

    const rejected = info.rejected ?? [];
    if (rejected.length > 0) {
      throw new Error(`SMTP a respins destinatarul: ${rejected.join(", ")}`);
    }
    if (!String(info.messageId ?? "").trim()) {
      throw new Error(
        `SMTP nu a confirmat trimiterea (${String(info.response ?? "").slice(0, 300) || "fără răspuns"})`
      );
    }

    await prisma.$transaction([
      prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { status: "SENT", sentAt: new Date(), errorMessage: null },
      }),
      prisma.payslip.update({
        where: { id: payslip.id },
        data: { emailSent: true, emailSentAt: new Date(), emailLogId: emailLog.id },
      }),
    ]);

    return { success: true, emailLogId: emailLog.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.$transaction([
      prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { status: "FAILED", sentAt: null, errorMessage: msg },
      }),
      prisma.payslip.update({
        where: { id: payslip.id },
        data: { emailSent: false, emailSentAt: null, emailLogId: emailLog.id },
      }),
    ]);
    throw new Error(`Trimitere email eșuată: ${msg}`);
  }
}

