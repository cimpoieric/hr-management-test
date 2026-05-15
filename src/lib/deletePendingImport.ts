import "server-only";

import { moveImportFileToRejected } from "@/lib/importStorage";
import { prisma } from "@/lib/prisma";

export type DeletePendingImportResult =
  | { ok: true }
  | { ok: false; kind: "NOT_FOUND" | "SERVER" };

/**
 * Moves source file under data/import/rejected/ when possible, then deletes PendingImport row.
 */
export async function deletePendingImportRecord(
  importId: number,
): Promise<DeletePendingImportResult> {
  try {
    const pending = await prisma.pendingImport.findUnique({
      where: { id: importId },
    });
    if (!pending) {
      return { ok: false, kind: "NOT_FOUND" };
    }

    try {
      await moveImportFileToRejected(pending.filePath, pending.fileName);
    } catch {
      // Missing file or rename failed; still delete DB row
    }

    await prisma.pendingImport.delete({ where: { id: importId } });
    return { ok: true };
  } catch {
    return { ok: false, kind: "SERVER" };
  }
}
