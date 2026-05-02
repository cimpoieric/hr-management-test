import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAppSettings } from "@/lib/appSettings";
import { getDocumentStats } from "@/lib/documentStats";

/** GET /api/documents/stats — KPI documente (aceleași valori ca panoul de control). */
export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const now = new Date();
    const settings = await getAppSettings();
    const stats = await getDocumentStats(now, settings.alertExpiredDocumentsDays);
    return NextResponse.json(
      { ...stats, documentAlertDays: settings.alertExpiredDocumentsDays },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DOCUMENTS_STATS_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
