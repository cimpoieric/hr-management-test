/**
 * POST /api/auth/change-password — Schimbare parolă curentă
 *
 * Body: { oldPassword: string, newPassword: string }
 * Validează: min 8 chars, 1 uppercase, 1 digit, 1 special
 * Setează mustChangePassword = false
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAuth, verifyPassword, hashPassword } from "@/lib/auth";
import { logAuditFF, getClientIp } from "@/lib/audit";

const changeSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string()
    .min(8, "Minim 8 caractere")
    .regex(/[A-Z]/, "Cel putin o majuscula")
    .regex(/[0-9]/, "Cel putin o cifra")
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, "Cel putin un caracter special"),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Neautentificat" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = changeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Date invalide" },
        { status: 400 }
      );
    }

    const { oldPassword, newPassword } = parsed.data;

    // Verifică parola veche
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, email: true, password: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilizator negasit" }, { status: 404 });
    }

    const valid = await verifyPassword(oldPassword, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Parola curenta e incorecta" }, { status: 401 });
    }

    // Hash și salvează parola nouă
    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: newHash,
        mustChangePassword: false,
      },
    });

    // Audit log
    logAuditFF({
      action: "PASSWORD_CHANGE",
      entity: "User",
      entityId: user.id,
      userId: user.id,
      userRole: user.role,
      ipAddress: getClientIp(request),
      details: "Schimbare parola de catre utilizator",
    });

    return NextResponse.json({ success: true, message: "Parola schimbata cu succes" });

  } catch {
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}
