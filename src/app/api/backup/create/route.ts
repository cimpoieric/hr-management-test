/**
 * POST /api/backup/create — Creează backup ZIP (ADMIN only)
 *
 * Export în memorie → R2: firm/{organizationId}/backup/{timestamp}.zip
 */

import { getClientIp, logAuditFF } from "@/lib/audit";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import {
  buildBackupDownloadPath,
  cleanupOldBackups,
  createBackup,
  resolveBackupPublicUrl,
} from "@/lib/backup";
import { checkPlan, FEATURES } from "@/lib/middleware/plan-check";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const planCheck = await checkPlan(request, FEATURES.AUTO_BACKUP, {
    roles: ROLES_SETTINGS_ADMIN,
  });
  if (!planCheck.allowed) return planCheck.response;
  const { user } = planCheck;

  try {
    await cleanupOldBackups(user.organizationId, 30);

    const backup = await createBackup(user.organizationId);

    logAuditFF({
      action: "BACKUP",
      entity: "System",
      userId: user.userId,
      userName: user.email,
      userRole: user.role,
      ipAddress: getClientIp(request),
      newValues: { filename: backup.filename, size: backup.size },
    });

    const downloadUrl =
      backup.downloadUrl ??
      resolveBackupPublicUrl(user.organizationId, backup.filename) ??
      buildBackupDownloadPath(backup.filename);

    return NextResponse.json({
      success: true,
      filename: backup.filename,
      size: backup.size,
      sizeFormatted: formatBytes(backup.size),
      password: backup.password,
      downloadUrl,
    });
  } catch (error) {
    console.error("[BACKUP_CREATE]", error);
    return NextResponse.json(
      {
        error:
          "Eroare la crearea backup: " +
          (error instanceof Error ? error.message : "unknown"),
      },
      { status: 500 },
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (
    Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  );
}
