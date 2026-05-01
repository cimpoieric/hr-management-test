/**
 * GET  /api/users — Lista utilizatori (ADMIN, fără passwordHash)
 * POST /api/users — Creează utilizator nou (ADMIN)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { logAuditFF, getClientIp } from "@/lib/audit";
import { generateTempPassword } from "@/lib/backup";

// ─── RBAC helper ─────────────────────────────────────────────────────────────

function requireAdmin(user: { role: string } | null, authError: NextResponse | null) {
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acces interzis. Doar ADMIN." }, { status: 403 });
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// GET — Lista utilizatori
// ══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  const error = requireAdmin(user, authError);
  if (error) return error;

  try {
    const { searchParams } = request.nextUrl;
    const includeInactive = searchParams.get("all") === "true";

    const users = await prisma.user.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        // NU include password — niciodată
      },
    });

    return NextResponse.json({ data: users, total: users.length });
  } catch (error) {
    console.error("[USERS_GET]", error);
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// POST — Creează utilizator nou
// ══════════════════════════════════════════════════════════════════════════════

const createSchema = z.object({
  email: z.string().email("Email invalid"),
  name: z.string().min(1, "Numele e obligatoriu").max(100),
  role: z.enum(["ADMIN", "OPERATOR", "READONLY"]),
});

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  const error = requireAdmin(user, authError);
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { email, name, role } = parsed.data;

    // Verifică unicitate email
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Există deja un utilizator cu acest email" },
        { status: 409 }
      );
    }

    // Generează parolă temporară
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        password: passwordHash,
        role,
        isActive: true,
        mustChangePassword: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    // Audit log
    logAuditFF({
      action: "CREATE",
      entity: "User",
      entityId: newUser.id,
      userId: user!.userId,
      userName: user!.email,
      userRole: user!.role,
      ipAddress: getClientIp(request),
      newValues: { name, email, role },
    });

    return NextResponse.json(
      {
        user: newUser,
        tempPassword,
        message: "Utilizator creat. Parola temporară e afișată o singură dată.",
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("[USERS_CREATE]", error);
    return NextResponse.json({ error: "Eroare la creare" }, { status: 500 });
  }
}
