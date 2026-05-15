import { prisma } from "@/lib/prisma";
import { getTenantRequestContext } from "@/lib/tenantRequestStorage";

export const APP_SETTING_KEYS = {
  companyName: "APP_COMPANY_NAME",
  companyCuiReg: "APP_COMPANY_CUI_REG",
  companyAddress: "APP_COMPANY_ADDRESS",
  legalRepName: "APP_LEGAL_REP_NAME",
  legalRepRole: "APP_LEGAL_REP_ROLE",
  companyIban: "APP_COMPANY_IBAN",
  companyBank: "APP_COMPANY_BANK",

  salaryDefaultCurrency: "APP_SALARY_DEFAULT_CURRENCY",
  salaryDefaultType: "APP_SALARY_DEFAULT_TYPE",
  standardMonthlyHours: "APP_STANDARD_MONTHLY_HOURS",
  standardWeeklyHours: "APP_STANDARD_WEEKLY_HOURS",

  dateFormat: "APP_DATE_FORMAT",
  language: "APP_LANGUAGE",
  timezone: "APP_TIMEZONE",

  alertExpiredDocumentsDays: "APP_ALERT_EXPIRED_DOCS_DAYS",
  alertExpiringDeploymentsDays: "APP_ALERT_EXPIRING_DEPLOYMENTS_DAYS",
  inAppNotificationsEnabled: "APP_IN_APP_NOTIFICATIONS_ENABLED",
} as const;

export type AppSettings = {
  companyName: string;
  companyCuiReg: string;
  companyAddress: string;
  legalRepName: string;
  legalRepRole: string;
  companyIban: string;
  companyBank: string;

  salaryDefaultCurrency: "RON" | "EUR" | "USD";
  salaryDefaultType: "LUNAR" | "SAPTAMANAL" | "ORA";
  standardMonthlyHours: number;
  standardWeeklyHours: number;

  dateFormat: "DD.MM.YYYY" | "YYYY-MM-DD";
  language: "ro" | "en";
  timezone: string;

  alertExpiredDocumentsDays: number;
  alertExpiringDeploymentsDays: number;
  inAppNotificationsEnabled: boolean;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  companyName: "",
  companyCuiReg: "",
  companyAddress: "",
  legalRepName: "",
  legalRepRole: "",
  companyIban: "",
  companyBank: "",

  salaryDefaultCurrency: "RON",
  salaryDefaultType: "LUNAR",
  standardMonthlyHours: 168,
  standardWeeklyHours: 40,

  dateFormat: "DD.MM.YYYY",
  language: "en",
  timezone: "Europe/Bucharest",

  alertExpiredDocumentsDays: 30,
  alertExpiringDeploymentsDays: 7,
  inAppNotificationsEnabled: true,
};

function resolveOrganizationId(organizationId?: string): string {
  const orgId = organizationId ?? getTenantRequestContext()?.organizationId;
  if (!orgId) {
    throw new Error("organizationId is required for organization settings");
  }
  return orgId;
}

function parsePreferencesJson(
  json: string | null | undefined,
): Partial<AppSettings> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Partial<AppSettings>;
  } catch {
    return {};
  }
}

function normalizeLanguage(value: string | null | undefined): AppSettings["language"] {
  return value === "en" ? "en" : "ro";
}

function mergeAppSettings(
  stored: Partial<AppSettings>,
  language: string | null | undefined,
): AppSettings {
  const merged: AppSettings = {
    ...DEFAULT_APP_SETTINGS,
    ...stored,
    language: normalizeLanguage(language ?? stored.language),
  };

  merged.standardMonthlyHours =
    Number(merged.standardMonthlyHours) ||
    DEFAULT_APP_SETTINGS.standardMonthlyHours;
  merged.standardWeeklyHours =
    Number(merged.standardWeeklyHours) ||
    DEFAULT_APP_SETTINGS.standardWeeklyHours;
  merged.alertExpiredDocumentsDays =
    Number(merged.alertExpiredDocumentsDays) ||
    DEFAULT_APP_SETTINGS.alertExpiredDocumentsDays;
  merged.alertExpiringDeploymentsDays =
    Number(merged.alertExpiringDeploymentsDays) ||
    DEFAULT_APP_SETTINGS.alertExpiringDeploymentsDays;
  merged.inAppNotificationsEnabled = merged.inAppNotificationsEnabled !== false;

  return merged;
}

export async function getAppSettings(
  organizationId?: string,
): Promise<AppSettings> {
  const orgId = resolveOrganizationId(organizationId);
  const row = await prisma.settings.findUnique({
    where: { organizationId: orgId },
  });

  return mergeAppSettings(
    parsePreferencesJson(row?.preferencesJson),
    row?.language,
  );
}

export async function saveAppSettings(
  settings: AppSettings,
  organizationId?: string,
): Promise<void> {
  const orgId = resolveOrganizationId(organizationId);
  const language = normalizeLanguage(settings.language);

  await prisma.settings.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      language,
      preferencesJson: JSON.stringify(settings),
    },
    update: {
      language,
      preferencesJson: JSON.stringify(settings),
    },
  });
}
