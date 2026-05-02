import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { documentsWhereVisible } from "@/lib/documentVisibility";

/** Aceeași definiție ca `GET /api/documents?status=expired` (status EXPIRED sau dată expirată). */
export function expiredDocumentsWhere(at: Date = new Date()): Prisma.DocumentWhereInput {
  return {
    OR: [
      { status: "EXPIRED" },
      {
        AND: [{ expiryDate: { not: null } }, { expiryDate: { lt: at } }],
      },
    ],
  };
}

export type DocumentKpiStats = {
  expiredDocuments: number;
  expiringSoonDocuments: number;
};

/**
 * KPI documente — aliniat la panou și la filtrul „expirate” din listă.
 * `expiringSoon`: `expiryDate` în fereastra [acum, acum + alertDays].
 */
export async function getDocumentStats(
  at: Date,
  alertExpiredDocumentsDays: number
): Promise<DocumentKpiStats> {
  const expiringLimit = new Date(
    at.getTime() + alertExpiredDocumentsDays * 24 * 60 * 60 * 1000
  );

  const [expiredDocuments, expiringSoonDocuments] = await Promise.all([
    prisma.document.count({
      where: documentsWhereVisible(expiredDocumentsWhere(at)),
    }),
    prisma.document.count({
      where: documentsWhereVisible({
        expiryDate: {
          not: null,
          gte: at,
          lte: expiringLimit,
        },
      }),
    }),
  ]);

  return { expiredDocuments, expiringSoonDocuments };
}
