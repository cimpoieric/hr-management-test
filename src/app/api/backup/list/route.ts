/**
 * GET /api/backup/list — Lista backup-uri (ADMIN only)
 *
 * Returnează: { backups: [...], stats: { totalCount, totalSize, latestBackup } }
 */

import { requireRole } from "@/lib/auth";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { getBackupStats, listBackups } from "@/lib/backup";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_SETTINGS_ADMIN,
  );
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
