/**
 * POST /api/documents/refresh-statuses
 *
 * Rulează jobul de actualizare a statusurilor documentelor.
 * Doar ADMIN.
 */

import { requireAuth, requireRole } from "@/lib/auth";
import { ROLES_EMPLOYEES_RW } from "@/lib/roles";
import { updateDocumentStatuses } from "@/lib/documentStatus.server";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_EMPLOYEES_RW,
  );
  if (authError || !user) return authError!;

  try {
    const result = await updateDocumentStatuses();

    return NextResponse.json(
      {
        message: "Statusuri actualizate",
        ...result,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[REFRESH_STATUSES]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
