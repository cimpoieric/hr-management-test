/**
 * GET /api/backup/download?filename=... — Descarcă backup ZIP din R2 (ADMIN only)
 * DELETE — Șterge backup
 */

import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { deleteBackup, getBackupBuffer } from "@/lib/backup";
import { checkPlan, FEATURES } from "@/lib/middleware/plan-check";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const planCheck = await checkPlan(request, FEATURES.AUTO_BACKUP, {
    roles: ROLES_SETTINGS_ADMIN,
  });
  if (!planCheck.allowed) return planCheck.response;
  const { user } = planCheck;

  try {
    const filename = request.nextUrl.searchParams.get("filename");
    if (!filename) {
      return NextResponse.json({ error: "Filename necesar" }, { status: 400 });
    }

    const buffer = await getBackupBuffer(user.organizationId, filename);

    return new NextResponse(new Uint8Array(buffer), {
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

export async function DELETE(request: NextRequest) {
  const planCheck = await checkPlan(request, FEATURES.AUTO_BACKUP, {
    roles: ROLES_SETTINGS_ADMIN,
  });
  if (!planCheck.allowed) return planCheck.response;
  const { user } = planCheck;

  try {
    const filename = request.nextUrl.searchParams.get("filename");
    if (!filename) {
      return NextResponse.json({ error: "Filename necesar" }, { status: 400 });
    }

    await deleteBackup(user.organizationId, filename);
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Eroare";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
