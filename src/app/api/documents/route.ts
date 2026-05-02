/**
 * GET /api/documents?employeeId={id}&type={type}&status={status}
 *
 * Lista documente cu filtrare per angajat, tip, status.
 * Include download URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { DOCUMENT_TYPES } from "@/lib/documentConstants";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);

    const employeeId = searchParams.get("employeeId");
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};

    if (employeeId) {
      where.employeeId = parseInt(employeeId, 10);
    }

    if (type && DOCUMENT_TYPES.includes(type as typeof DOCUMENT_TYPES[number])) {
      where.type = type;
    }

    if (status && ["VALID", "EXPIRING_SOON", "EXPIRED", "PENDING"].includes(status)) {
      where.status = status;
    }

    const documents = await prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, cnp: true },
        },
      },
    });

    const mapped = documents.map((doc) => ({
      id: doc.id,
      type: doc.type,
      number: doc.number,
      fileName: doc.fileName,
      status: doc.status,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      issueDate: doc.issueDate ? doc.issueDate.toISOString() : null,
      expiryDate: doc.expiryDate ? doc.expiryDate.toISOString() : null,
      uploadedAt: doc.uploadedAt.toISOString(),
      createdAt: doc.createdAt.toISOString(),
      employee: doc.employee,
      downloadUrl: `/api/documents/${doc.id}/download`,
    }));

    return NextResponse.json({ documents: mapped }, { status: 200 });
  } catch (error) {
    console.error("[DOCUMENTS_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
