/**
 * GET /api/backup/list — Lista backup-uri organizație (ADMIN only)
 */

import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { getBackupStats, listBackups } from "@/lib/backup";
import { checkPlan, FEATURES } from "@/lib/middleware/plan-check";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const planCheck = await checkPlan(request, FEATURES.AUTO_BACKUP, {
    roles: ROLES_SETTINGS_ADMIN,
  });
  if (!planCheck.allowed) return planCheck.response;
  const { user } = planCheck;

  try {
    const [backups, stats] = await Promise.all([
      listBackups(user.organizationId),
      getBackupStats(user.organizationId),
    ]);

    return NextResponse.json({ backups, stats });
  } catch (error) {
    console.error("[BACKUP_LIST]", error);
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}
