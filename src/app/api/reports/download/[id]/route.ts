/**
 * GET /api/reports/download/[id] — compatibilitate: redirecționează dacă id este cheie S3.
 * Rapoartele UUID vechi nu mai sunt disponibile (stocare R2).
 */

import { requireRole } from "@/lib/auth";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_SETTINGS_ADMIN,
  );
  if (authError || !user) {
    return (
      authError ??
      NextResponse.json({ error: "Neautentificat" }, { status: 401 })
    );
  }

  const { id } = await params;
  const decoded = decodeURIComponent(id);

  if (decoded.startsWith("firm/") && decoded.includes("/reports/")) {
    const url = new URL("/api/reports/download", request.url);
    url.searchParams.set("key", decoded);
    return NextResponse.redirect(url, 307);
  }

  return NextResponse.json(
    {
      error:
        "Raport negasit sau expirat. Genereaza din nou — stocarea s-a mutat pe cloud.",
    },
    { status: 410 },
  );
}
