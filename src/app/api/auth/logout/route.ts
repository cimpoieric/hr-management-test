/**
 * POST /api/auth/logout
 *
 * Șterge cookie-ul de autentificare și loghează deconectarea.
 */

import { getClientIp, logAuditFF } from "@/lib/audit";
import { clearAuthCookie, verifyAuth } from "@/lib/auth";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Audit: logout
    const auth = await verifyAuth(request);
    if (auth) {
      logAuditFF({
        action: "LOGOUT",
        entity: "User",
        entityId: null,
        userId: auth.userId,
        userName: auth.email,
        userRole: auth.role,
        ipAddress: getClientIp(request),
        details: "Deconectare utilizator",
      });
    }
  } catch {
    // ignore audit errors on logout
  }

  const response = NextResponse.json(
    { success: true, message: "Deconectat cu succes" },
    { status: 200 },
  );

  clearAuthCookie(response);

  return response;
}
