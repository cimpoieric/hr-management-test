/**
 * PUT    /api/users/[id] — Editează utilizator
 * DELETE /api/users/[id] — Soft delete
 */

import { getClientIp, logAuditFF } from "@/lib/audit";
import { hashPassword, requireRole } from "@/lib/auth";
import { superAdminDeletionForbiddenResponse } from "@/lib/protectedSuperAdminApi";
import { ROLES_SETTINGS_ADMIN, UserRole } from "@/lib/roles";
import { generateTempPassword } from "@/lib/backup";
import { prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const cuidParam = z.string().cuid();

function isDbAdminRole(role: string): boolean {
  return role === "ORG_ADMIN" || role === "SUPER_ADMIN";
}

function assertSameOrg(
  actor: { role: UserRole; organizationId: string },
  targetOrgId: string,
): boolean {
  if (actor.role === UserRole.SUPER_ADMIN) return true;
  return actor.organizationId === targetOrgId;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_SETTINGS_ADMIN,
  );
  if (authError || !user) return authError!;

  try {
    const { id } = await params;
    const idParsed = cuidParam.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }
    const userId = idParsed.data;

    const u = await prisma.user.findUnique({
      where: { id: userId },
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

    if (!u) {
      return NextResponse.json(
        { error: "Utilizator negasit" },
        { status: 404 },
      );
    }

    if (!assertSameOrg(user, u.organizationId)) {
      return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
    }

    return NextResponse.json({ data: u });
  } catch {
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
  resetPassword: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user: adminUser, response: authError } = await requireRole(
    request,
    ROLES_SETTINGS_ADMIN,
  );
  if (authError || !adminUser) return authError!;

  try {
    const { id } = await params;
    const idParsed = cuidParam.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }
    const userId = idParsed.data;

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { name, role, isActive, resetPassword } = parsed.data;

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        organizationId: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Utilizator negasit" },
        { status: 404 },
      );
    }

    if (!assertSameOrg(adminUser, existing.organizationId)) {
      return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
    }

    if (
      role === UserRole.SUPER_ADMIN &&
      adminUser.role !== UserRole.SUPER_ADMIN
    ) {
      return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
    }

    if (isActive === false && isDbAdminRole(existing.role)) {
      const adminCount = await prisma.user.count({
        where: {
          role: { in: ["ORG_ADMIN", "SUPER_ADMIN"] },
          isActive: true,
        },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Nu poti dezactiva singurul administrator" },
          { status: 400 },
        );
      }
    }

    if (isActive === false && userId === adminUser.userId) {
      return NextResponse.json(
        { error: "Nu te poti dezactiva pe tine insuti" },
        { status: 400 },
      );
    }

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

      logAuditFF({
        action: "PASSWORD_CHANGE",
        entity: "User",
        entityId: null,
        userId: adminUser.userId,
        userName: adminUser.email,
        userRole: adminUser.role,
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
        organizationId: true,
        isActive: true,
        mustChangePassword: true,
        updatedAt: true,
      },
    });

    logAuditFF({
      action: "UPDATE",
      entity: "User",
      entityId: null,
      userId: adminUser.userId,
      userName: adminUser.email,
      userRole: adminUser.role,
      ipAddress: getClientIp(request),
      oldValues: {
        name: existing.name,
        role: existing.role,
        isActive: existing.isActive,
      },
      newValues: updateData,
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("[USERS_PUT]", error);
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user: adminUser, response: authError } = await requireRole(
    request,
    ROLES_SETTINGS_ADMIN,
  );
  if (authError || !adminUser) return authError!;

  try {
    const { id } = await params;
    const idParsed = cuidParam.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }
    const userId = idParsed.data;

    if (userId === adminUser.userId) {
      return NextResponse.json(
        { error: "Nu te poti sterge pe tine insuti" },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        organizationId: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Utilizator negasit" },
        { status: 404 },
      );
    }

    if (!assertSameOrg(adminUser, existing.organizationId)) {
      return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
    }

    const blocked = superAdminDeletionForbiddenResponse(existing);
    if (blocked) return blocked;

    if (isDbAdminRole(existing.role)) {
      const adminCount = await prisma.user.count({
        where: {
          role: { in: ["ORG_ADMIN", "SUPER_ADMIN"] },
          isActive: true,
        },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Nu poti sterge singurul administrator" },
          { status: 400 },
        );
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    logAuditFF({
      action: "DELETE",
      entity: "User",
      entityId: null,
      userId: adminUser.userId,
      userName: adminUser.email,
      userRole: adminUser.role,
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
