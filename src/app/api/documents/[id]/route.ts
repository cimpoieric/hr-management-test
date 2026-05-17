/**
 * DELETE /api/documents/[id]
 *
 * Soft delete: `deletedAt` în DB + mută fișier în _deleted/.
 * Doar ADMIN și OPERATOR.
 */

import { logAuditForUser } from "@/lib/auditInsert";
import { requireAuth, requireRole } from "@/lib/auth";
import { ROLES_EMPLOYEES_RW } from "@/lib/roles";
import { employeeHasActiveDeployment } from "@/lib/deploymentGuards";
import { canDeleteEmployee, canEditEmployee } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { fileExists, softDeleteFile } from "@/lib/storage";
import { type NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_EMPLOYEES_RW,
  );
  if (authError || !user) return authError!;
  if (!canEditEmployee(user.role)) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const documentId = Number.parseInt(id, 10);
    if (isNaN(documentId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const document = await prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
      select: {
        id: true,
        fileName: true,
        storagePath: true,
        type: true,
        employeeId: true,
        status: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document negăsit" }, { status: 404 });
    }

    if (!canDeleteEmployee(user.role)) {
      if (document.status === "EXPIRED") {
        return NextResponse.json(
          {
            error: "Documentele expirate pot fi șterse doar de administrator.",
          },
          { status: 403 },
        );
      }
      const hasActive = await employeeHasActiveDeployment(document.employeeId);
      if (hasActive) {
        return NextResponse.json(
          {
            error:
              "Documentele angajaților cu detașare activă pot fi șterse doar de administrator.",
          },
          { status: 403 },
        );
      }
    }

    const fileOnDisk = await fileExists(document.storagePath);
    if (fileOnDisk) {
      await softDeleteFile(document.storagePath);
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });

    logAuditForUser(user, request, {
      action: "DOCUMENT_DELETED",
      resource: "Document",
      resourceId: documentId,
      oldValues: JSON.stringify({
        documentId,
        fileName: document.fileName,
        type: document.type,
        employeeId: document.employeeId,
        status: document.status,
      }),
    });

    return NextResponse.json(
      { message: "Document șters", id: documentId },
      { status: 200 },
    );
  } catch (error) {
    console.error("[DOCUMENT_DELETE]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
