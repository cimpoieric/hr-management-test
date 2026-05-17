/**
 * POST /api/deployments/sync-country-mismatch
 * Backfill: creeaza/inchide detasari pentru angajati cu tara != tara firmei.
 */

import { requireRole } from "@/lib/auth";
import { ROLES_EMPLOYEES_RW } from "@/lib/roles";
import { backfillDeploymentsForCountryMismatch } from "@/lib/syncEmployeeDeploymentByCountry";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_EMPLOYEES_RW,
  );
  if (authError || !user) return authError!;

  try {
    const result = await backfillDeploymentsForCountryMismatch();
    return NextResponse.json({
      success: true,
      message:
        result.created > 0
          ? `${result.created} detasari create (tara angajat != tara firma).`
          : "Nicio detasare noua necesara.",
      ...result,
    });
  } catch (error) {
    console.error("[DEPLOYMENTS_SYNC_COUNTRY_MISMATCH]", error);
    return NextResponse.json(
      { error: "Eroare la sincronizarea detasarilor pe tara" },
      { status: 500 },
    );
  }
}
