/**
 * GET /api/documents?employeeId={id}&type={type}&status={status}
 *
 * Lista documente cu filtrare per angajat, tip, status.
 * Include download URL.
 */

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { DOCUMENT_TYPES } from "@/lib/documentConstants";
import { expiredDocumentsWhere } from "@/lib/documentStats";
import { documentsWhereVisible } from "@/lib/documentVisibility";

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

    const where: Prisma.DocumentWhereInput = {};
    const now = new Date();

    if (employeeId) {
      where.employeeId = parseInt(employeeId, 10);
    }

    if (type && DOCUMENT_TYPES.includes(type as (typeof DOCUMENT_TYPES)[number])) {
      where.type = type;
    }

    if (status) {
      const raw = status.trim();
      const low = raw.toLowerCase();
      if (low === "expired" || raw.toUpperCase() === "EXPIRED") {
        Object.assign(where, expiredDocumentsWhere(now));
      } else {
        const upper = raw.toUpperCase();
        if (["VALID", "EXPIRING_SOON", "PENDING"].includes(upper)) {
          where.status = upper;
        }
      }
    }

    const documents = await prisma.document.findMany({
      where: documentsWhereVisible(where),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        employeeId: true,
        type: true,
        number: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        status: true,
        issueDate: true,
        expiryDate: true,
        uploadedAt: true,
        createdAt: true,
        employee: {
          select: { id: true, firstName: true, lastName: true, cnp: true },
        },
      },
    });

    const empIds = [...new Set(documents.map((d) => d.employeeId))];
    const activeDeploymentRows =
      empIds.length === 0
        ? []
        : await prisma.deployment.findMany({
            where: {
              employeeId: { in: empIds },
              status: "ACTIVE",
              OR: [{ endDate: null }, { endDate: { gte: now } }],
            },
            select: { employeeId: true },
          });
    const employeesWithActiveDeployment = new Set(
      activeDeploymentRows.map((r) => r.employeeId)
    );

    const mapped = documents.map((doc) => ({
      id: doc.id,
      employeeId: doc.employeeId,
      type: doc.type,
      number: doc.number,
      fileName: doc.fileName,
      status: doc.status,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      issueDate: doc.issueDate != null ? doc.issueDate.toISOString() : null,
      expiryDate: doc.expiryDate != null ? doc.expiryDate.toISOString() : null,
      uploadedAt: doc.uploadedAt.toISOString(),
      createdAt: doc.createdAt.toISOString(),
      employee: doc.employee,
      employeeHasActiveDeployment: employeesWithActiveDeployment.has(
        doc.employeeId
      ),
      downloadUrl: `/api/documents/${doc.id}/download`,
    }));

    return NextResponse.json({ documents: mapped }, { status: 200 });
  } catch (error) {
    console.error("[DOCUMENTS_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
