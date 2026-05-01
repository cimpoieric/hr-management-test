/**
 * DELETE /api/documents/[id]
 *
 * Soft delete: șterge record DB + mută fișier în _deleted/.
 * Doar ADMIN și OPERATOR.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canEditEmployee } from "@/lib/permissions";
import { fileExists, softDeleteFile } from "@/lib/storage";

export async function DELETE(
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
    const documentId = parseInt(id, 10);
    if (isNaN(documentId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        fileName: true,
        storagePath: true,
        type: true,
        employeeId: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document negăsit" }, { status: 404 });
    }

    // Mută fișierul în _deleted/ (soft delete)
    const fileOnDisk = await fileExists(document.storagePath);
    if (fileOnDisk) {
      await softDeleteFile(document.storagePath);
    }

    // Șterge din DB
    await prisma.document.delete({ where: { id: documentId } });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "Document",
        entityId: documentId,
        oldValues: JSON.stringify({
          fileName: document.fileName,
          type: document.type,
          employeeId: document.employeeId,
        }),
      },
    });

    return NextResponse.json(
      { message: "Document șters", id: documentId },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DOCUMENT_DELETE]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
