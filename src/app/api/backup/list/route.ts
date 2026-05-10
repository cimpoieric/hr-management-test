/**
 * GET /api/backup/list — Lista backup-uri (ADMIN only)
 *
 * Returnează: { backups: [...], stats: { totalCount, totalSize, latestBackup } }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listBackups, getBackupStats } from "@/lib/backup";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request, ["administrator"]);
  if (authError || !user) return authError!;

  try {
    const [backups, stats] = await Promise.all([
      listBackups(),
      getBackupStats(),
    ]);

    return NextResponse.json({ backups, stats });
  } catch (error) {
    console.error("[BACKUP_LIST]", error);
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}
