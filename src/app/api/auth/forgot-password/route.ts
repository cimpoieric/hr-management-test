/**
 * POST /api/auth/forgot-password
 *
 * Trimite link de resetare parola (Resend API sau SMTP).
 * Raspuns generic daca contul nu exista (nu dezvaluim existenta emailului).
 */

import { resolveAppBaseUrl } from "@/lib/appUrl";
import { getClientIp, logAuditFF } from "@/lib/audit";
import { generatePasswordResetToken } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import {
  getActiveEmailProvider,
  isTransactionalEmailConfigured,
} from "@/lib/mail/transactional";
import { prismaBase as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const forgotSchema = z.object({
  email: z.string().email("Email invalid"),
});

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resolveResetOrigin(request: NextRequest): string {
  try {
    return new URL(resolveAppBaseUrl()).origin;
  } catch {
    return request.nextUrl.origin;
  }
}

function logEmailEnvDiagnostics(): void {
  const provider = getActiveEmailProvider();
  console.log("[AUTH_FORGOT_PASSWORD] email provider:", provider ?? "NONE");
  console.log(
    "[AUTH_FORGOT_PASSWORD] RESEND_API_KEY:",
    process.env.RESEND_API_KEY?.trim() ? "EXISTS" : "MISSING",
  );
  console.log(
    "[AUTH_FORGOT_PASSWORD] SMTP_USER:",
    process.env.SMTP_USER?.trim() ? "EXISTS" : "MISSING",
  );
}

export async function POST(request: NextRequest) {
  logEmailEnvDiagnostics();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Date invalide" },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const genericResponse = NextResponse.json({
    success: true,
    message:
      "Daca exista un cont activ cu acest email, vei primi un link de resetare in cateva minute.",
  });

  if (!(await isTransactionalEmailConfigured())) {
    console.error("[AUTH_FORGOT_PASSWORD] Email not configured");
    return NextResponse.json(
      {
        success: false,
        error:
          "Serviciul de email nu este configurat (RESEND_API_KEY sau SMTP pe Vercel).",
      },
      { status: 503 },
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return genericResponse;
    }

    const token = await generatePasswordResetToken(user.id, user.email);
    const resetUrl = new URL("/reset-password", resolveResetOrigin(request));
    resetUrl.searchParams.set("token", token);
    const resetLink = resetUrl.toString();

    const displayName = user.name?.trim() || user.email;
    const safeName = escapeHtml(displayName);
    const safeUrl = escapeHtml(resetLink);

    const html = `
        <h2>Resetare parola</h2>
        <p>Buna, ${safeName},</p>
        <p>Ai solicitat resetarea parolei pentru contul HR Management.</p>
        <p>Click <a href="${safeUrl}">aici</a> pentru a reseta parola.</p>
        <p>Link: <a href="${safeUrl}">${safeUrl}</a></p>
        <p>Linkul expira in 1 ora. Daca nu ai solicitat resetarea, ignora acest email.</p>
      `;

    const result = await sendEmail({
      to: user.email,
      subject: "Resetare parola HR Management",
      html,
      templateKey: "PASSWORD_RESET",
      toName: displayName,
    });

    console.log(
      "[AUTH_FORGOT_PASSWORD] sent, ids:",
      result.messageIds,
    );

    logAuditFF({
      action: "PASSWORD_CHANGE",
      entity: "User",
      entityId: null,
      userId: user.id,
      userName: user.email,
      userRole: user.role,
      ipAddress: getClientIp(request),
      details: `Solicitare resetare parola: ${email}`,
    });
  } catch (error) {
    console.error("[AUTH_FORGOT_PASSWORD] Forgot password error:", error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("JWT_SECRET")) {
      return NextResponse.json(
        {
          success: false,
          error: "Configurare server invalida (JWT_SECRET). Contacteaza administratorul.",
        },
        { status: 500 },
      );
    }

    if (
      message.includes("SMTP") ||
      message.includes("Resend") ||
      message.includes("not configured") ||
      message.includes("Failed to send") ||
      message.includes("Email send failed")
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Nu s-a putut trimite emailul de resetare. Verifica RESEND_API_KEY sau SMTP pe Vercel.",
          detail: process.env.NODE_ENV === "development" ? message : undefined,
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Eroare interna la procesarea cererii.",
        detail: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 },
    );
  }

  return genericResponse;
}
