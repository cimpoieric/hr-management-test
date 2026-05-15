import { logAuditFF, getClientIp } from "@/lib/audit";
import { withAdminApi } from "@/lib/adminApi";
import type { AuthContext } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { clearLoginRateLimitForEmail } from "@/lib/loginRateLimit";
import { prismaBase as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  email: z.string().email("Email invalid"),
  newPassword: z
    .string()
    .min(10, "Parola trebuie sa aiba minim 10 caractere")
    .max(128, "Parola este prea lunga"),
});

/**
 * POST /api/admin/reset-password
 * SUPER_ADMIN only. Sets a new bcrypt password and forces change on next login.
 */
export async function POST(request: NextRequest) {
  return withAdminApi(request, async (admin: AuthContext) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utilizatorul nu exista cu acest email" },
        { status: 404 },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Utilizatorul este dezactivat" },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        mustChangePassword: true,
        failedAttempts: 0,
      },
    });

    clearLoginRateLimitForEmail(email);

    logAuditFF({
      action: "PASSWORD_CHANGE",
      entity: "User",
      entityId: null,
      userId: admin.userId,
      userName: admin.email,
      userRole: admin.role,
      ipAddress: getClientIp(request),
      details: `Admin reset password for ${user.email} (mustChangePassword=true)`,
    });

    return NextResponse.json({
      success: true,
      email: user.email,
      mustChangePassword: true,
      message: "Parola a fost setata. Utilizatorul trebuie sa o schimbe la primul login.",
    });
  });
}
