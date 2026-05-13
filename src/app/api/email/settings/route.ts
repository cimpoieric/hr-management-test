import { requireRole } from "@/lib/auth";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { decrypt, encrypt } from "@/lib/encryption";
import { prismaTyped as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { z } from "zod";

const putSchema = z.object({
  host: z.string().trim().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  user: z.string().trim().min(1),
  password: z.string().optional(),
  fromEmail: z.string().trim().min(1),
  fromName: z.string().trim().min(1),
  subjectTemplate: z.string().trim().min(1).max(200).optional(),
  bodyTemplate: z.string().optional(),
  isActive: z.coerce.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_SETTINGS_ADMIN,
  );
  if (authError || !user) return authError!;

  try {
    const row = await prisma.emailSettings.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      host: row?.smtpHost ?? "",
      port: Number(row?.smtpPort ?? 587),
      user: row?.smtpUser ?? "",
      hasPassword: Boolean((row?.smtpPass ?? "").trim()),
      fromEmail: row?.fromEmail ?? "",
      fromName: row?.fromName ?? "HR Management",
      subjectTemplate: row?.subjectTemplate ?? "Fluturas salariu - {luna} {an}",
      bodyTemplate: row?.bodyTemplate ?? "",
      isActive: row?.isActive ?? true,
    });
  } catch (error) {
    console.error("[SMTP_SETTINGS_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  return handleSave(request);
}

export async function POST(request: NextRequest) {
  return handleSave(request);
}

async function handleSave(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_SETTINGS_ADMIN,
  );
  if (authError || !user) return authError!;

  try {
    const body = await request.json().catch(() => null);
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues?.[0]?.message?.trim() || "Body invalid",
        },
        { status: 400 },
      );
    }

    const v = parsed.data;
    const existing = await prisma.emailSettings.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    const incomingPass =
      typeof v.password === "string" ? v.password.trim() : "";
    const hasIncomingPass = incomingPass.length > 0;

    const passwordToStore = hasIncomingPass
      ? encrypt(incomingPass)
      : (existing?.smtpPass ?? "");

    // We must verify SMTP before saving. If password isn't provided, use stored password (decrypt).
    let verifyPass: string | null = null;
    if (hasIncomingPass) {
      verifyPass = incomingPass;
    } else if (passwordToStore.trim()) {
      try {
        verifyPass = decrypt(passwordToStore);
      } catch (e) {
        console.error("[SMTP_SETTINGS_DECRYPT]", e);
        verifyPass = null;
      }
    }

    // Validate SMTP connection BEFORE saving (requirement)
    if (!verifyPass) {
      return NextResponse.json(
        {
          error:
            "Parola SMTP lipsa sau nu poate fi decriptata. Introduceti parola pentru a testa conexiunea si a salva.",
        },
        { status: 400 },
      );
    }
    const transporter = nodemailer.createTransport({
      host: v.host,
      port: v.port,
      secure: v.port === 465,
      auth: { user: v.user, pass: verifyPass },
      tls: { rejectUnauthorized: false },
    });
    await transporter.verify();

    await prisma.emailSettings.create({
      data: {
        smtpHost: v.host,
        smtpPort: v.port,
        smtpUser: v.user,
        smtpPass: passwordToStore,
        fromEmail: v.fromEmail,
        fromName: v.fromName,
        subjectTemplate: v.subjectTemplate ?? "Fluturas salariu - {luna} {an}",
        bodyTemplate: v.bodyTemplate ?? "",
        isActive: v.isActive ?? true,
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SMTP_SETTINGS_PUT]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
