import { requireAuth } from "@/lib/auth";
import {
  GDPR_REQUEST_STATUSES,
  type GdprRequestStatus,
} from "@/lib/gdpr";
import { prismaBase as prisma } from "@/lib/prisma";
import { isJwtRoleIn, ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { isSuperAdminRole } from "@/middleware/adminAccess";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(GDPR_REQUEST_STATUSES),
  adminNotes: z.string().max(5000).optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return (
      authError ??
      NextResponse.json({ error: "Neautentificat" }, { status: 401 })
    );
  }

  if (!isJwtRoleIn(user, ROLES_SETTINGS_ADMIN)) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const existing = await prisma.gdprRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Solicitare neg?sit?" }, { status: 404 });
    }

    if (
      !isSuperAdminRole(user.role) &&
      existing.firmId !== user.organizationId
    ) {
      return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
    }

    const json = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const status = parsed.data.status as GdprRequestStatus;
    const resolvedAt =
      status === "completed" || status === "rejected" ? new Date() : null;

    const updated = await prisma.gdprRequest.update({
      where: { id },
      data: {
        status,
        adminNotes:
          parsed.data.adminNotes !== undefined
            ? parsed.data.adminNotes?.trim() || null
            : undefined,
        resolvedAt,
      },
    });

    return NextResponse.json({
      success: true,
      request: {
        id: updated.id,
        status: updated.status,
        adminNotes: updated.adminNotes,
        resolvedAt: updated.resolvedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("[ADMIN_GDPR_REQUEST_PATCH]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
