/**
 * POST /api/backup/restore — Încarcă ZIP din memorie (ADMIN only)
 *
 * Creează safety backup în R2 înainte de validare.
 * Restaurarea automată a datelor JSON nu este încă activată pe PostgreSQL.
 */

import { getClientIp, logAuditFF } from "@/lib/audit";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { restoreFromBackupBuffer } from "@/lib/backup";
import { checkPlan, FEATURES } from "@/lib/middleware/plan-check";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const planCheck = await checkPlan(request, FEATURES.AUTO_BACKUP, {
    roles: ROLES_SETTINGS_ADMIN,
  });
  if (!planCheck.allowed) return planCheck.response;
  const { user } = planCheck;

  try {
    const formData = await request.formData();
    const file = formData.get("backup") as File | null;

    if (!file || !file.name.endsWith(".zip")) {
      return NextResponse.json(
        { error: "Fișier ZIP necesar" },
        { status: 400 },
      );
    }

    if (file.size > 2 * 1024 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Fișier prea mare (max 2GB)" },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await restoreFromBackupBuffer(
      user.organizationId,
      buffer,
    );

    logAuditFF({
      action: "BACKUP",
      entity: "System",
      userId: user.userId,
      userName: user.email,
      userRole: user.role,
      ipAddress: getClientIp(request),
      newValues: {
        type: "RESTORE",
        restored: result.restored,
        safetyBackup: result.safetyBackup,
        sourceFile: file.name,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Restaurare completă",
      safetyBackup: result.safetyBackup,
      restored: result.restored,
    });
  } catch (error) {
    console.error("[BACKUP_RESTORE]", error);
    return NextResponse.json(
      {
        error:
          "Eroare la restaurare: " +
          (error instanceof Error ? error.message : "unknown"),
      },
      { status: 500 },
    );
  }
}
