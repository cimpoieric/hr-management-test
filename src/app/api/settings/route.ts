import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { requireAuth } from "@/lib/auth";
import { DEFAULT_APP_SETTINGS, getAppSettings, saveAppSettings, type AppSettings } from "@/lib/appSettings";

function normalizeIncoming(body: Partial<AppSettings>): AppSettings {
  return {
    companyName: (body.companyName ?? "").trim(),
    companyCuiReg: (body.companyCuiReg ?? "").trim(),
    companyAddress: (body.companyAddress ?? "").trim(),
    legalRepName: (body.legalRepName ?? "").trim(),
    legalRepRole: (body.legalRepRole ?? "").trim(),
    companyIban: (body.companyIban ?? "").trim(),
    companyBank: (body.companyBank ?? "").trim(),
    salaryDefaultCurrency:
      body.salaryDefaultCurrency === "EUR" || body.salaryDefaultCurrency === "USD" ? body.salaryDefaultCurrency : "RON",
    salaryDefaultType:
      body.salaryDefaultType === "SAPTAMANAL" || body.salaryDefaultType === "ORA" ? body.salaryDefaultType : "LUNAR",
    standardMonthlyHours: Number(body.standardMonthlyHours ?? DEFAULT_APP_SETTINGS.standardMonthlyHours) || 168,
    standardWeeklyHours: Number(body.standardWeeklyHours ?? DEFAULT_APP_SETTINGS.standardWeeklyHours) || 40,
    dateFormat: body.dateFormat === "YYYY-MM-DD" ? "YYYY-MM-DD" : "DD.MM.YYYY",
    language: body.language === "en" ? "en" : "ro",
    timezone: (body.timezone ?? "Europe/Bucharest").trim() || "Europe/Bucharest",
    alertExpiredDocumentsDays:
      Number(body.alertExpiredDocumentsDays ?? DEFAULT_APP_SETTINGS.alertExpiredDocumentsDays) || 30,
    alertExpiringDeploymentsDays:
      Number(body.alertExpiringDeploymentsDays ?? DEFAULT_APP_SETTINGS.alertExpiringDeploymentsDays) || 7,
    inAppNotificationsEnabled: body.inAppNotificationsEnabled !== false,
  };
}

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }
  const settings = await getAppSettings();
  return NextResponse.json({
    ...settings,
    dbPath: join(process.cwd(), "prisma", "dev.db"),
  });
}

export async function PUT(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request, ["ADMIN"]);
  if (authError || !user) return authError!;

  const body = (await request.json()) as Partial<AppSettings>;
  const normalized = normalizeIncoming(body);
  await saveAppSettings(normalized);
  return NextResponse.json({ success: true });
}
