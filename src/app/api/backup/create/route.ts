/**
 * POST /api/backup/create — Creează backup ZIP (ADMIN only)
 *
 * Returnează: { filename, size, password }
 * AuditLog: BACKUP action
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createBackup, cleanupOldBackups } from "@/lib/backup";
import { logAuditFF, getClientIp } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  // ADMIN only
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acces interzis. Doar ADMIN." }, { status: 403 });
  }

  try {
    // Cleanup backup-uri vechi (>30 zile)
    await cleanupOldBackups(30);

    // Creează backup
    const backup = await createBackup();

    // Audit log
    logAuditFF({
      action: "BACKUP",
      entity: "System",
      userId: user.userId,
      userName: user.email,
      userRole: user.role,
      ipAddress: getClientIp(request),
      newValues: { filename: backup.filename, size: backup.size },
    });

    return NextResponse.json({
      success: true,
      filename: backup.filename,
      size: backup.size,
      sizeFormatted: formatBytes(backup.size),
      password: backup.password,
    });

  } catch (error) {
    console.error("[BACKUP_CREATE]", error);
    return NextResponse.json(
      { error: "Eroare la crearea backup: " + (error instanceof Error ? error.message : "unknown") },
      { status: 500 }
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
