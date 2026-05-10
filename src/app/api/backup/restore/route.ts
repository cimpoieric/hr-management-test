/**
 * POST /api/backup/restore — Restaurează din ZIP uploadat (ADMIN only)
 *
 * Body: form-data cu câmpul "backup" (fișier ZIP)
 * Proces:
 *   1. Creează safety backup automat
 *   2. Validează structura arhivei
 *   3. Extrage și suprascrie
 *   4. AuditLog
 *
 * ATENȚIE: Operațiune distructivă — toate datele noi vor fi pierdute.
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, rm } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { requireAuth } from "@/lib/auth";
import { restoreFromBackup } from "@/lib/backup";
import { logAuditFF, getClientIp } from "@/lib/audit";

const TEMP_DIR = join(process.cwd(), "data", "temp");

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request, ["administrator"]);
  if (authError || !user) return authError!;

  let tempFile: string | null = null;

  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get("backup") as File | null;

    if (!file || !file.name.endsWith(".zip")) {
      return NextResponse.json(
        { error: "Fișier ZIP necesar" },
        { status: 400 }
      );
    }

    // Max 2GB
    if (file.size > 2 * 1024 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Fișier prea mare (max 2GB)" },
        { status: 400 }
      );
    }

    // Salvează temporar
    if (!existsSync(TEMP_DIR)) {
      await mkdir(TEMP_DIR, { recursive: true });
    }

    tempFile = join(TEMP_DIR, `restore_${Date.now()}.zip`);
    const bytes = await file.arrayBuffer();
    await writeFile(tempFile, Buffer.from(bytes));

    // Restaurează
    const result = await restoreFromBackup(tempFile);

    // Șterge fișierul temporar
    try { if (tempFile) await rm(tempFile); } catch { /* ignore */ }

    // Audit log
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
      warning: "Aplicația trebuie repornită pentru reconectarea la baza de date.",
    });

  } catch (error) {
    // Curăță fișierul temporar
    if (tempFile) {
      try { await rm(tempFile); } catch { /* ignore */ }
    }

    console.error("[BACKUP_RESTORE]", error);
    return NextResponse.json(
      { error: "Eroare la restaurare: " + (error instanceof Error ? error.message : "unknown") },
      { status: 500 }
    );
  }
}
