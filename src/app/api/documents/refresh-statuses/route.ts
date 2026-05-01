/**
 * POST /api/documents/refresh-statuses
 *
 * Rulează jobul de actualizare a statusurilor documentelor.
 * Doar ADMIN.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { updateDocumentStatuses } from "@/lib/documentStatus.server";

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request, ["ADMIN"]);
  if (authError || !user) return authError!;
  if (!canManageUsers(user.role)) {
    return NextResponse.json({ error: "Acces interzis — doar ADMIN" }, { status: 403 });
  }

  try {
    const result = await updateDocumentStatuses();

    return NextResponse.json(
      {
        message: "Statusuri actualizate",
        ...result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[REFRESH_STATUSES]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
