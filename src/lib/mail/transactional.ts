import "server-only";

import {
  getSMTPConfig,
  getSMTPConfigFromEnv,
  testSMTPConfig,
  type SMTPConfig,
} from "@/lib/services/email";
import nodemailer from "nodemailer";

export type EmailProvider = "resend" | "smtp";

export type TransactionalEmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromEmail?: string;
  fromName?: string;
};

export function getDefaultFromAddress(): { fromEmail: string; fromName: string } {
  const fromName = (process.env.FROM_NAME?.trim() || "HR Management").trim();
  const fromEmail = (
    process.env.FROM_EMAIL?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "onboarding@resend.dev"
  ).trim();
  return { fromEmail, fromName };
}

export function formatFromHeader(fromEmail: string, fromName: string): string {
  return `"${fromName.replaceAll('"', "")}" <${fromEmail}>`;
}

export function getActiveEmailProvider(): EmailProvider | null {
  if (process.env.RESEND_API_KEY?.trim()) return "resend";
  if (getSMTPConfigFromEnv()) return "smtp";
  return null;
}

export async function isTransactionalEmailConfigured(): Promise<boolean> {
  if (getActiveEmailProvider()) return true;
  try {
    await getSMTPConfig();
    return true;
  } catch {
    return false;
  }
}

async function sendViaResend(
  payload: TransactionalEmailPayload,
  fromEmail: string,
  fromName: string,
): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const from = formatFromHeader(fromEmail, fromName);

  const { data, error } = await resend.emails.send({
    from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });

  if (error) {
    throw new Error(`Resend: ${error.message}`);
  }
  const messageId = data?.id?.trim();
  if (!messageId) {
    throw new Error("Resend: no message id returned");
  }
  return messageId;
}

async function sendViaSmtp(
  payload: TransactionalEmailPayload,
  cfg: SMTPConfig,
): Promise<string> {
  await testSMTPConfig(cfg);
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const info = await transporter.sendMail({
    from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });

  const messageId = String(info.messageId ?? "").trim();
  if (!messageId) {
    throw new Error("SMTP did not return messageId");
  }
  return messageId;
}

/** Resend (preferred on Vercel) ? SMTP env ? SMTP from DB. */
export async function sendTransactionalEmail(
  payload: TransactionalEmailPayload,
): Promise<{ messageId: string; provider: EmailProvider }> {
  const defaults = getDefaultFromAddress();
  const fromEmail = payload.fromEmail?.trim() || defaults.fromEmail;
  const fromName = payload.fromName?.trim() || defaults.fromName;

  if (process.env.RESEND_API_KEY?.trim()) {
    const messageId = await sendViaResend(payload, fromEmail, fromName);
    return { messageId, provider: "resend" };
  }

  const cfg = await getSMTPConfig();
  const messageId = await sendViaSmtp(payload, cfg);
  return { messageId, provider: "smtp" };
}
