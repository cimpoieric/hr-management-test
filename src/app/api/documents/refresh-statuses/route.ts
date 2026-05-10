/**
 * POST /api/documents/refresh-statuses
 *
 * Rulează jobul de actualizare a statusurilor documentelor.
 * Doar ADMIN.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, WRITE_ROLES } from "@/lib/auth";
import { updateDocumentStatuses } from "@/lib/documentStatus.server";

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request, WRITE_ROLES);
  if (authError || !user) return authError!;

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
