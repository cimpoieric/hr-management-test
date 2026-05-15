/**
 * POST /api/deployments/sync-detached
 * Creeaza inregistrari Deployment pentru angajati marcati detasati in profil.
 */

import { requireRole } from "@/lib/auth";
import { ROLES_EMPLOYEES_RW } from "@/lib/roles";
import { syncDetachedEmployeesDeployments } from "@/lib/syncDetachedDeployments";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_EMPLOYEES_RW,
  );
  if (authError || !user) return authError!;

  try {
    const result = await syncDetachedEmployeesDeployments();
    return NextResponse.json({
      success: true,
      message:
        result.created > 0
          ? `${result.created} detasari create din profilul angajatilor.`
          : "Nu exista angajati de sincronizat (sau au deja detasare activa).",
      ...result,
    });
  } catch (error) {
    console.error("[DEPLOYMENTS_SYNC_DETACHED]", error);
    return NextResponse.json(
      { error: "Eroare la sincronizarea detasarilor" },
      { status: 500 },
    );
  }
}
