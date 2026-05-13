/**
 * GET /api/backup/download?filename=... — Descarcă backup ZIP (ADMIN only)
 *
 * Verifică path traversal, servește fișierul ca attachment.
 */

import { requireRole } from "@/lib/auth";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { deleteBackup, getBackupPath } from "@/lib/backup";
import { readFile } from "fs/promises";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_SETTINGS_ADMIN,
  );
  if (authError || !user) return authError!;

  try {
    const filename = request.nextUrl.searchParams.get("filename");
    if (!filename) {
      return NextResponse.json({ error: "Filename necesar" }, { status: 400 });
    }

    const filePath = getBackupPath(filename);
    const buffer = await readFile(filePath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Eroare";
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}

/**
 * DELETE /api/backup/download?filename=... — Șterge un backup (ADMIN only)
 */
export async function DELETE(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_SETTINGS_ADMIN,
  );
  if (authError || !user) return authError!;

  try {
    const filename = request.nextUrl.searchParams.get("filename");
    if (!filename) {
      return NextResponse.json({ error: "Filename necesar" }, { status: 400 });
    }

    await deleteBackup(filename);
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Eroare";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
