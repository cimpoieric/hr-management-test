import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prismaTyped as prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { encrypt } from "@/lib/encryption";

const CONFIG_KEYS = {
  host: "smtp.host",
  port: "smtp.port",
  user: "smtp.user",
  pass: "smtp.pass",
  fromEmail: "smtp.fromEmail",
  fromName: "smtp.fromName",
  secure: "smtp.secure",
  payslipTemplate: "email.template.payslip",
} as const;

const putSchema = z.object({
  host: z.string().trim().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  user: z.string().trim().min(1),
  password: z.string().optional(),
  fromEmail: z.string().trim().min(1),
  fromName: z.string().trim().min(1),
  secure: z.coerce.boolean(),
  payslipTemplate: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request, ["ADMIN"]);
  if (authError || !user) return authError!;
  if (!canManageUsers(user.role)) {
    return NextResponse.json({ error: "Acces interzis — doar ADMIN" }, { status: 403 });
  }

  try {
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: Object.values(CONFIG_KEYS) } },
      select: { key: true, value: true },
    });

    const get = (key: string) => configs.find((c) => c.key === key)?.value;

    return NextResponse.json({
      host: get(CONFIG_KEYS.host) ?? "",
      port: Number(get(CONFIG_KEYS.port) ?? "587"),
      user: get(CONFIG_KEYS.user) ?? "",
      hasPassword: Boolean((get(CONFIG_KEYS.pass) ?? "").trim()),
      fromEmail: get(CONFIG_KEYS.fromEmail) ?? "",
      fromName: get(CONFIG_KEYS.fromName) ?? "",
      secure: (get(CONFIG_KEYS.secure) ?? "false") === "true",
      payslipTemplate: get(CONFIG_KEYS.payslipTemplate) ?? "",
    });
  } catch (error) {
    console.error("[SMTP_SETTINGS_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request, ["ADMIN"]);
  if (authError || !user) return authError!;
  if (!canManageUsers(user.role)) {
    return NextResponse.json({ error: "Acces interzis — doar ADMIN" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Body invalid" }, { status: 400 });
    }

    const v = parsed.data;
    const entries: Array<{ key: string; value: string }> = [
      { key: CONFIG_KEYS.host, value: v.host },
      { key: CONFIG_KEYS.port, value: String(v.port) },
      { key: CONFIG_KEYS.user, value: v.user },
      { key: CONFIG_KEYS.fromEmail, value: v.fromEmail },
      { key: CONFIG_KEYS.fromName, value: v.fromName },
      { key: CONFIG_KEYS.secure, value: String(v.secure) },
      { key: CONFIG_KEYS.payslipTemplate, value: v.payslipTemplate ?? "" },
    ];

    if (typeof v.password === "string" && v.password.trim().length > 0) {
      entries.push({ key: CONFIG_KEYS.pass, value: encrypt(v.password.trim()) });
    }

    for (const entry of entries) {
      await prisma.systemConfig.upsert({
        where: { key: entry.key },
        update: { value: entry.value },
        create: { key: entry.key, value: entry.value },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SMTP_SETTINGS_PUT]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}

