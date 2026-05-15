// DELETE /api/import/[id] - remove PendingImport

import { requireAuth, requireRole } from "@/lib/auth";
import { ROLES_EMPLOYEES_RW } from "@/lib/roles";
import { deletePendingImportRecord } from "@/lib/deletePendingImport";
import { type NextRequest, NextResponse } from "next/server";

const MSG_NOT_FOUND = "Import neg\u0103sit";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_EMPLOYEES_RW,
  );
  if (authError || !user) return authError!;

  try {
    const { id } = await params;
    const importId = Number.parseInt(id, 10);
    if (isNaN(importId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const result = await deletePendingImportRecord(importId);
    if (!result.ok && result.kind === "NOT_FOUND") {
      return NextResponse.json({ error: MSG_NOT_FOUND }, { status: 404 });
    }
    if (!result.ok) {
      return NextResponse.json({ error: "Eroare server" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: importId }, { status: 200 });
  } catch (error) {
    console.error("[IMPORT_DELETE]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
