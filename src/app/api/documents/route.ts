/**
 * GET /api/documents
 *
 * Query: employeeId, type, status (bucket sau status DB), search, page, limit
 * Paginare server: limit implicit 50, max 200. Răspuns: total, totalPages, page, stats.
 */

import { getAppSettings } from "@/lib/appSettings";
import { requireAuth } from "@/lib/auth";
import { DOCUMENT_TYPES } from "@/lib/documentConstants";
import { expiredDocumentsWhere } from "@/lib/documentStats";
import { documentsWhereVisible } from "@/lib/documentVisibility";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

function expiringSoonWindowWhere(
  at: Date,
  alertExpiredDocumentsDays: number,
): Prisma.DocumentWhereInput {
  const expiringLimit = new Date(
    at.getTime() + alertExpiredDocumentsDays * 24 * 60 * 60 * 1000,
  );
  return {
    expiryDate: {
      not: null,
      gte: at,
      lte: expiringLimit,
    },
  };
}

function validBucketWhere(
  at: Date,
  alertExpiredDocumentsDays: number,
): Prisma.DocumentWhereInput {
  const expiringLimit = new Date(
    at.getTime() + alertExpiredDocumentsDays * 24 * 60 * 60 * 1000,
  );
  return {
    AND: [
      { NOT: expiredDocumentsWhere(at) },
      { status: { not: "PENDING" } },
      {
        NOT: {
          expiryDate: {
            not: null,
            gte: at,
            lte: expiringLimit,
          },
        },
      },
    ],
  };
}

function searchWhere(term: string): Prisma.DocumentWhereInput {
  const t = term.trim();
  if (t.length === 0) return {};
  const safe = t.length > 200 ? t.slice(0, 200) : t;
  const parts: Prisma.DocumentWhereInput[] = [
    { fileName: { contains: safe } },
    { number: { contains: safe } },
    {
      employee: {
        OR: [
          { firstName: { contains: safe } },
          { lastName: { contains: safe } },
        ],
      },
    },
    { type: { contains: safe } },
  ];
  const asNum = Number.parseInt(safe, 10);
  if (!Number.isNaN(asNum) && String(asNum) === safe) {
    parts.push({ employeeId: asNum });
  }
  return { OR: parts };
}

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return (
      authError ??
      NextResponse.json({ error: "Neautentificat" }, { status: 401 })
    );
  }

  try {
    const { searchParams } = request.nextUrl;
    const now = new Date();

    const page = Math.max(
      1,
      Number.parseInt(searchParams.get("page") ?? "1", 10),
    );
    const limit = Math.min(
      200,
      Math.max(1, Number.parseInt(searchParams.get("limit") ?? "50", 10)),
    );
    const skip = (page - 1) * limit;

    const employeeIdRaw = searchParams.get("employeeId");
    const type = searchParams.get("type");
    const statusRaw = searchParams.get("status");
    const search = searchParams.get("search")?.trim() ?? "";

    const settings = await getAppSettings(user.organizationId);
    const alertDays = settings.alertExpiredDocumentsDays;

    const andParts: Prisma.DocumentWhereInput[] = [];

    if (employeeIdRaw) {
      const id = Number.parseInt(employeeIdRaw, 10);
      if (!Number.isNaN(id)) {
        andParts.push({ employeeId: id });
      }
    }

    if (
      type &&
      DOCUMENT_TYPES.includes(type as (typeof DOCUMENT_TYPES)[number])
    ) {
      andParts.push({ type });
    }

    if (statusRaw) {
      const raw = statusRaw.trim();
      const low = raw.toLowerCase();
      if (low === "expired" || raw.toUpperCase() === "EXPIRED") {
        andParts.push(expiredDocumentsWhere(now));
      } else if (
        low === "expiring" ||
        low === "expiring_soon" ||
        raw.toUpperCase() === "EXPIRING"
      ) {
        andParts.push(expiringSoonWindowWhere(now, alertDays));
      } else if (raw.toUpperCase() === "VALID") {
        andParts.push(validBucketWhere(now, alertDays));
      } else {
        const upper = raw.toUpperCase();
        if (["EXPIRING_SOON", "PENDING"].includes(upper)) {
          andParts.push({ status: upper });
        }
      }
    }

    if (search.length > 0) {
      andParts.push(searchWhere(search));
    }

    const combined: Prisma.DocumentWhereInput =
      andParts.length === 0
        ? {}
        : andParts.length === 1
          ? andParts[0]!
          : { AND: andParts };

    const visibleWhere = documentsWhereVisible(combined);

    const withExpired = andParts.length
      ? ({
          AND: [combined, expiredDocumentsWhere(now)],
        } as Prisma.DocumentWhereInput)
      : expiredDocumentsWhere(now);
    const withExpiring = andParts.length
      ? ({
          AND: [combined, expiringSoonWindowWhere(now, alertDays)],
        } as Prisma.DocumentWhereInput)
      : expiringSoonWindowWhere(now, alertDays);

    const expiredFacetWhere = documentsWhereVisible(withExpired);
    const expiringFacetWhere = documentsWhereVisible(withExpiring);

    const [documents, total, expiredInFilter, expiringSoonInFilter] =
      await Promise.all([
        prisma.document.findMany({
          where: visibleWhere,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
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
        }),
        prisma.document.count({ where: visibleWhere }),
        prisma.document.count({ where: expiredFacetWhere }),
        prisma.document.count({ where: expiringFacetWhere }),
      ]);

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
      activeDeploymentRows.map((r) => r.employeeId),
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
        doc.employeeId,
      ),
      downloadUrl: `/api/documents/${doc.id}/download`,
    }));

    const totalPages = Math.ceil(total / limit) || (total > 0 ? 1 : 0);

    return NextResponse.json(
      {
        documents: mapped,
        page,
        limit,
        total,
        totalPages,
        stats: {
          expired: expiredInFilter,
          expiringSoon: expiringSoonInFilter,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[DOCUMENTS_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
