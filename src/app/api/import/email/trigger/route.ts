/**
 * POST /api/import/email/trigger
 *
 * Declanșează manual procesarea emailurilor.
 * Doar ADMIN și OPERATOR.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { canEditEmployee } from "@/lib/permissions";
import { triggerManualImport } from "@/lib/cron";

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request, [
    "ADMIN",
    "OPERATOR",
  ]);
  if (authError || !user) return authError!;
  if (!canEditEmployee(user.role)) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  try {
    const result = await triggerManualImport();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[EMAIL_TRIGGER]", error);
    return NextResponse.json(
      { error: "Eroare la procesare", message: error instanceof Error ? error.message : "?" },
      { status: 500 }
    );
  }
}
