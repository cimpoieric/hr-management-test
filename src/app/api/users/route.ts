/**
 * GET  /api/users — Lista utilizatori (admin organizație / super)
 * POST /api/users — Creează utilizator nou
 */

import { getClientIp, logAuditFF } from "@/lib/audit";
import { hashPassword, requireRole } from "@/lib/auth";
import { ROLES_SETTINGS_ADMIN, UserRole } from "@/lib/roles";
import { generateTempPassword } from "@/lib/backup";
import { prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_SETTINGS_ADMIN,
  );
  if (authError || !user) return authError!;

  try {
    const { searchParams } = request.nextUrl;
    const includeInactive = searchParams.get("all") === "true";

    const orgWhere =
      user.role === UserRole.SUPER_ADMIN
        ? {}
        : { organizationId: user.organizationId };

    const users = await prisma.user.findMany({
      where: includeInactive ? orgWhere : { ...orgWhere, isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        isActive: true,
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: users, total: users.length });
  } catch (error) {
    console.error("[USERS_GET]", error);
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}

const createSchema = z.object({
  email: z.string().email("Email invalid"),
  name: z.string().min(1, "Numele e obligatoriu").max(100),
  role: z.nativeEnum(UserRole),
});

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_SETTINGS_ADMIN,
  );
  if (authError || !user) return authError!;

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { email, name, role } = parsed.data;

    if (role === UserRole.SUPER_ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Există deja un utilizator cu acest email" },
        { status: 409 },
      );
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        password: passwordHash,
        role,
        organizationId: user.organizationId,
        isActive: true,
        mustChangePassword: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    logAuditFF({
      action: "CREATE",
      entity: "User",
      entityId: null,
      userId: user.userId,
      userName: user.email,
      userRole: user.role,
      ipAddress: getClientIp(request),
      newValues: { name, email, role },
    });

    return NextResponse.json(
      {
        user: newUser,
        tempPassword,
        message: "Utilizator creat. Parola temporară e afișată o singură dată.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[USERS_CREATE]", error);
    return NextResponse.json({ error: "Eroare la creare" }, { status: 500 });
  }
}
