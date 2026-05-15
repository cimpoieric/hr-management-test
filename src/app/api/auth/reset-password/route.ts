/**
 * POST /api/auth/reset-password
 *
 * Seteaz? o parol? nou? folosind tokenul din linkul de resetare.
 */

import { getClientIp, logAuditFF } from "@/lib/audit";
import {
  hashPassword,
  verifyPasswordResetToken,
} from "@/lib/auth";
import { prismaBase as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const resetSchema = z.object({
  token: z.string().min(1, "Token invalid"),
  newPassword: z
    .string()
    .min(8, "Minim 8 caractere")
    .regex(/[A-Z]/, "Cel putin o majuscula")
    .regex(/[0-9]/, "Cel putin o cifra")
    .regex(
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
      "Cel putin un caracter special",
    ),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Date invalide" },
      { status: 400 },
    );
  }

  const { token, newPassword } = parsed.data;

  try {
    const payload = await verifyPasswordResetToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (
      !user ||
      !user.isActive ||
      user.email.toLowerCase() !== payload.email
    ) {
      return NextResponse.json(
        { error: "Link de resetare invalid sau expirat" },
        { status: 400 },
      );
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: newHash,
        mustChangePassword: false,
      },
    });

    logAuditFF({
      action: "PASSWORD_CHANGE",
      entity: "User",
      entityId: null,
      userId: user.id,
      userName: user.email,
      userRole: user.role,
      ipAddress: getClientIp(request),
      details: `Resetare parola prin link: ${user.email}`,
    });

    return NextResponse.json({
      success: true,
      message: "Parola a fost resetata cu succes",
    });
  } catch {
    return NextResponse.json(
      { error: "Link de resetare invalid sau expirat" },
      { status: 400 },
    );
  }
}
