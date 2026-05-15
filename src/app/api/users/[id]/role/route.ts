/**
 * PATCH /api/users/[id]/role — schimbă rolul unui utilizator
 */

import { getClientIp, logAuditFF } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { ROLES_SETTINGS_ADMIN, UserRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const roleSchema = z.object({
  role: z.nativeEnum(UserRole),
});

const cuidParam = z.string().cuid();

function isDbAdminRole(role: string): boolean {
  return role === "ORG_ADMIN" || role === "SUPER_ADMIN";
}

export async function PATCH(
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

    const body = await request.json().catch(() => null);
    const parsed = roleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Body invalid", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const nextRole = parsed.data.role;

    if (
      nextRole === UserRole.SUPER_ADMIN &&
      adminUser.role !== UserRole.SUPER_ADMIN
    ) {
      return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
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

    if (
      adminUser.role !== UserRole.SUPER_ADMIN &&
      existing.organizationId !== adminUser.organizationId
    ) {
      return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
    }

    if (existing.role === nextRole) {
      return NextResponse.json({
        ok: true,
        user: existing,
      });
    }

    if (
      isDbAdminRole(existing.role) &&
      !isDbAdminRole(nextRole) &&
      existing.isActive
    ) {
      const adminCount = await prisma.user.count({
        where: {
          role: { in: ["ORG_ADMIN", "SUPER_ADMIN"] },
          isActive: true,
        },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Nu poti schimba rolul ultimului administrator activ" },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: nextRole },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
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
      oldValues: { role: existing.role },
      newValues: { role: nextRole },
      details: `Schimbare rol user ${userId} (${existing.email})`,
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("[USER_ROLE_PATCH]", error);
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}
