import "server-only";

/**
 * Operații cu bază de date pentru status documente.
 *
 * Server-only — folosit doar în API routes și server actions.
 * Funcții pure sunt în documentStatus.ts
 */

import { prisma } from "@/lib/prisma";
import { calculateStatus } from "@/lib/documentStatus";
import { documentsWhereVisible } from "@/lib/documentVisibility";

/**
 * Actualizează statusurile tuturor documentelor din DB.
 * Returnează numărul de documente care au schimbat status.
 */
export async function updateDocumentStatuses(): Promise<{
  updated: number;
  expired: number;
  expiringSoon: number;
}> {
  const documents = await prisma.document.findMany({
    where: documentsWhereVisible({ status: { not: "EXPIRED" } }),
    select: {
      id: true,
      status: true,
      expiryDate: true,
      employeeId: true,
      type: true,
    },
  });

  let updated = 0;
  let expired = 0;
  let expiringSoonCount = 0;

  for (const doc of documents) {
    const newStatus = calculateStatus(doc.expiryDate);

    if (newStatus !== doc.status) {
      await prisma.document.update({
        where: { id: doc.id },
        data: { status: newStatus },
      });

      updated++;

      if (newStatus === "EXPIRED") {
        expired++;
        // Loghează în AuditLog
        await prisma.auditLog.create({
          data: {
            action: "STATUS_CHANGE",
            entity: "Document",
            entityId: doc.employeeId,
            oldValues: JSON.stringify({
              documentId: doc.id,
              status: doc.status,
            }),
            newValues: JSON.stringify({
              documentId: doc.id,
              status: "EXPIRED",
            }),
          },
        });
      }

      if (newStatus === "EXPIRING_SOON") {
        expiringSoonCount++;
      }
    }
  }

  return { updated, expired, expiringSoon: expiringSoonCount };
}

/**
 * Returnează summary de documente pe status.
 */
export async function getDocumentStatusSummary(): Promise<{
  valid: number;
  expiringSoon: number;
  expired: number;
  pending: number;
  total: number;
}> {
  const [valid, expiringSoon, expired, pending] = await Promise.all([
    prisma.document.count({
      where: documentsWhereVisible({ status: "VALID" }),
    }),
    prisma.document.count({
      where: documentsWhereVisible({ status: "EXPIRING_SOON" }),
    }),
    prisma.document.count({
      where: documentsWhereVisible({ status: "EXPIRED" }),
    }),
    prisma.document.count({
      where: documentsWhereVisible({ status: "PENDING" }),
    }),
  ]);

  return { valid, expiringSoon, expired, pending, total: valid + expiringSoon + expired + pending };
}
