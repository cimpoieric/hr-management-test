/**
 * PUT    /api/deployments/[id]  — Actualizare cu verificare overlap
 * DELETE /api/deployments/[id]  — Soft delete (status → CANCELLED)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canEditEmployee, canDeleteEmployee } from "@/lib/permissions";
import { isValidCountryCode, isValidDeploymentStatus, getCountryName } from "@/lib/countries";

async function logAudit(
  action: string,
  entityId: number,
  oldValues?: unknown,
  newValues?: unknown,
  ipAddress?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity: "Deployment",
        entityId,
        oldValues: oldValues ? JSON.stringify(oldValues) : null,
        newValues: newValues ? JSON.stringify(newValues) : null,
        ipAddress: ipAddress ?? null,
      },
    });
  } catch (e) {
    console.error("[AUDIT_LOG]", e);
  }
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

async function checkOverlap(
  employeeId: number,
  startDate: Date,
  endDate: Date | null,
  status: string,
  excludeId?: number
): Promise<string | null> {
  if (status !== "ACTIVE") return null;

  const where: Record<string, unknown> = {
    employeeId,
    status: "ACTIVE",
  };
  if (excludeId) {
    where.id = { not: excludeId };
  }

  const existing = await prisma.deployment.findMany({
    where,
    select: { id: true, startDate: true, endDate: true, country: true },
  });

  for (const dep of existing) {
    const depEnd = dep.endDate ?? new Date("2099-12-31");
    const newEnd = endDate ?? new Date("2099-12-31");

    if (startDate <= depEnd && dep.startDate <= newEnd) {
      return `Angajatul are deja o detașare ACTIVE în ${getCountryName(dep.country)} (${new Date(
        dep.startDate
      ).toLocaleDateString("ro-RO")} – ${
        dep.endDate ? new Date(dep.endDate).toLocaleDateString("ro-RO") : "prezent"
      })`;
    }
  }
  return null;
}

// ─── PUT ─────────────────────────────────────────────────────────────────────

const updateSchema = z.object({
  country: z.string().length(2).optional(),
  city: z.string().max(100).nullable().optional(),
  externalCompany: z.string().max(200).nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  status: z.string().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response: authError } = await requireAuth(request, [
    "ADMIN",
    "OPERATOR",
  ]);
  if (authError || !user) return authError!;
  if (!canEditEmployee(user.role)) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const deploymentId = parseInt(id, 10);
    if (isNaN(deploymentId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const existing = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { id: true, employeeId: true, startDate: true, endDate: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Detașare negăsită" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Parse date
    const startDate = data.startDate ? new Date(data.startDate) : existing.startDate;
    const endDate =
      data.endDate === null
        ? null
        : data.endDate
        ? new Date(data.endDate)
        : existing.endDate;
    const status = data.status ?? existing.status;

    // Validări
    if (endDate && startDate >= endDate) {
      return NextResponse.json(
        { error: "DATE_INVALID", message: "Data început trebuie să fie înainte de sfârșit" },
        { status: 400 }
      );
    }

    if (data.country && !isValidCountryCode(data.country)) {
      return NextResponse.json(
        { error: "COUNTRY_INVALID" },
        { status: 400 }
      );
    }

    if (data.status && !isValidDeploymentStatus(data.status)) {
      return NextResponse.json(
        { error: "STATUS_INVALID" },
        { status: 400 }
      );
    }

    // Overlap check
    const overlapError = await checkOverlap(
      existing.employeeId,
      startDate,
      endDate,
      status,
      deploymentId
    );
    if (overlapError) {
      return NextResponse.json({ error: "OVERLAP", message: overlapError }, { status: 409 });
    }

    // Build update
    const updateData: Record<string, unknown> = {};
    if (data.country) updateData.country = data.country.toUpperCase();
    if (data.city !== undefined) updateData.city = data.city;
    if (data.startDate) updateData.startDate = startDate;
    if (data.endDate !== undefined) updateData.endDate = endDate;
    if (data.status) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await prisma.deployment.update({
      where: { id: deploymentId },
      data: updateData,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await logAudit(
      "UPDATE",
      deploymentId,
      existing,
      updateData,
      getClientIp(request)
    );

    return NextResponse.json({ deployment: updated }, { status: 200 });
  } catch (error) {
    console.error("[DEPLOYMENTS_PUT]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}

// ─── DELETE (soft) ───────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response: authError } = await requireAuth(request, [
    "ADMIN",
    "OPERATOR",
  ]);
  if (authError || !user) return authError!;
  if (!canDeleteEmployee(user.role)) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const deploymentId = parseInt(id, 10);
    if (isNaN(deploymentId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const existing = await prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Detașare negăsită" }, { status: 404 });
    }

    const updated = await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: "CANCELLED" },
    });

    await logAudit(
      "DELETE",
      deploymentId,
      { status: existing.status },
      { status: "CANCELLED" },
      getClientIp(request)
    );

    return NextResponse.json(
      { message: "Detașare anulată", id: updated.id, status: updated.status },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DEPLOYMENTS_DELETE]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
