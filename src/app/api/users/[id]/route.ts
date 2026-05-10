/**
 * PUT    /api/users/[id] — Editează utilizator (ADMIN)
 * DELETE /api/users/[id] — Soft delete (ADMIN)
 *
 * Acțiuni:
 *   PUT { name, role, isActive } — editare
 *   PUT { resetPassword: true } — resetare parolă (generează nouă temporară)
 *   DELETE — dezactivează user (soft delete)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword } from "@/lib/auth";
import { logAuditFF, getClientIp } from "@/lib/audit";
import { generateTempPassword } from "@/lib/backup";

// ─── GET — detalii user ──────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response: authError } = await requireAuth(request, ["administrator"]);
  if (authError || !user) return authError!;

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const u = await prisma.user.findUnique({
      where: { id: userId },
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
      },
    });

    if (!u) {
      return NextResponse.json({ error: "Utilizator negasit" }, { status: 404 });
    }

    return NextResponse.json({ data: u });
  } catch {
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}

// ─── PUT — editare / resetare parolă ─────────────────────────────────────────

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(["administrator", "operator", "doar_vizualizare"]).optional(),
  isActive: z.boolean().optional(),
  resetPassword: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: adminUser, response: authError } = await requireAuth(request, ["administrator"]);
  if (authError || !adminUser) return authError!;

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, role, isActive, resetPassword } = parsed.data;

    // Verifică că userul există
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Utilizator negasit" }, { status: 404 });
    }

    // Nu poți dezactiva singurul admin
    if (isActive === false && existing.role === "administrator") {
      const adminCount = await prisma.user.count({
        where: { role: "administrator", isActive: true },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Nu poti dezactiva singurul administrator" },
          { status: 400 }
        );
      }
    }

    // Nu te poți dezactiva pe tine însuți
    if (isActive === false && userId === adminUser!.userId) {
      return NextResponse.json(
        { error: "Nu te poti dezactiva pe tine insuti" },
        { status: 400 }
      );
    }

    // Resetare parolă
    if (resetPassword) {
      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);

      await prisma.user.update({
        where: { id: userId },
        data: {
          password: passwordHash,
          mustChangePassword: true,
        },
      });

      // Audit log
      logAuditFF({
        action: "PASSWORD_CHANGE",
        entity: "User",
        entityId: userId,
        userId: adminUser!.userId,
        userName: adminUser!.email,
        userRole: adminUser!.role,
        ipAddress: getClientIp(request),
        details: `Resetare parola pentru ${existing.email}`,
      });

      return NextResponse.json({
        message: "Parola resetata",
        tempPassword,
        user: {
          id: existing.id,
          name: existing.name,
          email: existing.email,
        },
      });
    }

    // Editare normală
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nicio modificare" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        updatedAt: true,
      },
    });

    // Audit log
    logAuditFF({
      action: "UPDATE",
      entity: "User",
      entityId: userId,
      userId: adminUser!.userId,
      userName: adminUser!.email,
      userRole: adminUser!.role,
      ipAddress: getClientIp(request),
      oldValues: { name: existing.name, role: existing.role, isActive: existing.isActive },
      newValues: updateData,
    });

    return NextResponse.json({ user: updated });

  } catch (error) {
    console.error("[USERS_PUT]", error);
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}

// ─── DELETE — soft delete (dezactivează) ─────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: adminUser, response: authError } = await requireAuth(request, ["administrator"]);
  if (authError || !adminUser) return authError!;

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    // Nu te poți șterge pe tine însuți
    if (userId === adminUser!.userId) {
      return NextResponse.json(
        { error: "Nu te poti sterge pe tine insuti" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Utilizator negasit" }, { status: 404 });
    }

    // Nu poți șterge singurul admin
    if (existing.role === "administrator") {
      const adminCount = await prisma.user.count({
        where: { role: "administrator", isActive: true },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Nu poti sterge singurul administrator" },
          { status: 400 }
        );
      }
    }

    // Soft delete: dezactivează
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    // Audit log
    logAuditFF({
      action: "DELETE",
      entity: "User",
      entityId: userId,
      userId: adminUser!.userId,
      userName: adminUser!.email,
      userRole: adminUser!.role,
      ipAddress: getClientIp(request),
      oldValues: { isActive: existing.isActive },
      newValues: { isActive: false },
    });

    return NextResponse.json({
      message: "Utilizator dezactivat",
      userId,
    });

  } catch (error) {
    console.error("[USERS_DELETE]", error);
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}
