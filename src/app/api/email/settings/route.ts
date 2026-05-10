import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import nodemailer from "nodemailer";
import { prismaTyped as prisma } from "@/lib/prisma";
import { requireAuth, WRITE_ROLES } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { decrypt, encrypt } from "@/lib/encryption";

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
  console.log("[SMTP_SETTINGS][GET] start");
  const { user, response: authError } = await requireAuth(request, WRITE_ROLES);
  console.log("[SMTP_SETTINGS][GET] auth", { hasUser: Boolean(user), hasAuthError: Boolean(authError) });
  if (authError || !user) return authError!;
  if (!canManageUsers(user.role)) {
    console.log("[SMTP_SETTINGS][GET] forbidden", { role: user.role });
    return NextResponse.json({ error: "Acces interzis — doar ADMIN" }, { status: 403 });
  }

  try {
    console.log("[SMTP_SETTINGS][GET] querying emailSettings");
    const row = await prisma.emailSettings.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    console.log("[SMTP_SETTINGS][GET] row", {
      found: Boolean(row),
      hasPass: Boolean((row?.smtpPass ?? "").trim()),
      updatedAt: row?.updatedAt ?? null,
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
  return handleSave(request, "PUT");
}

export async function POST(request: NextRequest) {
  return handleSave(request, "POST");
}

async function handleSave(request: NextRequest, method: "PUT" | "POST") {
  console.log(`[SMTP_SETTINGS][${method}] start`);
  const { user, response: authError } = await requireAuth(request, WRITE_ROLES);
  console.log(`[SMTP_SETTINGS][${method}] auth`, { hasUser: Boolean(user), hasAuthError: Boolean(authError) });
  if (authError || !user) return authError!;
  if (!canManageUsers(user.role)) {
    console.log(`[SMTP_SETTINGS][${method}] forbidden`, { role: user.role });
    return NextResponse.json({ error: "Acces interzis — doar ADMIN" }, { status: 403 });
  }

  try {
    console.log(`[SMTP_SETTINGS][${method}] reading body`);
    const body = await request.json().catch(() => null);
    console.log(
      `[SMTP_SETTINGS][${method}] body keys`,
      body && typeof body === "object" ? Object.keys(body as any) : null
    );
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      console.log(`[SMTP_SETTINGS][${method}] body invalid`, parsed.error.issues?.[0]?.message);
      return NextResponse.json({ error: "Body invalid" }, { status: 400 });
    }

    const v = parsed.data;
    console.log(`[SMTP_SETTINGS][${method}] parsed`, {
      host: v.host,
      port: v.port,
      user: v.user ? "***" : "",
      fromEmail: v.fromEmail,
      fromName: v.fromName,
      hasPasswordInBody: typeof v.password === "string" && v.password.trim().length > 0,
      isActive: v.isActive ?? true,
    });
    const existing = await prisma.emailSettings.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    console.log(`[SMTP_SETTINGS][${method}] existing`, {
      found: Boolean(existing),
      hasStoredPass: Boolean((existing?.smtpPass ?? "").trim()),
      updatedAt: existing?.updatedAt ?? null,
    });

    const incomingPass = typeof v.password === "string" ? v.password.trim() : "";
    const hasIncomingPass = incomingPass.length > 0;

    const passwordToStore = hasIncomingPass ? encrypt(incomingPass) : existing?.smtpPass ?? "";
    console.log(`[SMTP_SETTINGS][${method}] passwordToStore`, {
      hasIncomingPass,
      willStorePass: Boolean(passwordToStore.trim()),
    });

    // We must verify SMTP before saving. If password isn't provided, use stored password (decrypt).
    let verifyPass: string | null = null;
    if (hasIncomingPass) {
      verifyPass = incomingPass;
    } else if (passwordToStore.trim()) {
      try {
        console.log(`[SMTP_SETTINGS][${method}] decrypting stored password`);
        verifyPass = decrypt(passwordToStore);
        console.log(`[SMTP_SETTINGS][${method}] decrypt ok`);
      } catch (e) {
        console.error("[SMTP_SETTINGS_DECRYPT]", e);
        verifyPass = null;
      }
    }

    // Validate SMTP connection BEFORE saving (requirement)
    if (!verifyPass) {
      console.log(`[SMTP_SETTINGS][${method}] no password available for verify`);
      return NextResponse.json(
        {
          error:
            "Parola SMTP lipsa sau nu poate fi decriptata. Introduceti parola pentru a testa conexiunea si a salva.",
        },
        { status: 400 }
      );
    }
    console.log(`[SMTP_SETTINGS][${method}] verifying SMTP`, {
      host: v.host,
      port: v.port,
      secure: v.port === 465,
    });
    const transporter = nodemailer.createTransport({
      host: v.host,
      port: v.port,
      secure: v.port === 465,
      auth: { user: v.user, pass: verifyPass },
      tls: { rejectUnauthorized: false },
    });
    await transporter.verify();
    console.log(`[SMTP_SETTINGS][${method}] SMTP verify OK`);

    console.log(`[SMTP_SETTINGS][${method}] saving EmailSettings row`);
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
    console.log(`[SMTP_SETTINGS][${method}] saved OK`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SMTP_SETTINGS_PUT]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}

