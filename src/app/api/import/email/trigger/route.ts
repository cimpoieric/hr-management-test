/**
 * POST /api/import/email/trigger
 *
 * Declanșează manual procesarea emailurilor.
 * Doar ADMIN și OPERATOR.
 */

import { requireAuth, requireRole } from "@/lib/auth";
import { ROLES_EMPLOYEES_RW } from "@/lib/roles";
import { triggerManualImport } from "@/lib/cron";
import { canEditEmployee } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_EMPLOYEES_RW,
  );
  if (authError || !user) return authError!;
  if (!canEditEmployee(user.role)) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  try {
    const result = await triggerManualImport();
    void logAudit({
      userId: user.userId,
      userEmail: user.email,
      action: "IMPORT_DATA",
      resource: "System",
      details: { source: "EMAIL_TRIGGER" },
      req: request,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[EMAIL_TRIGGER]", error);
    return NextResponse.json(
      {
        error: "Eroare la procesare",
        message: error instanceof Error ? error.message : "?",
      },
      { status: 500 },
    );
  }
}
