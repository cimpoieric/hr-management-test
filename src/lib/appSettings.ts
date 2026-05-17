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
  /** Country id (Country table) for primary company / deployment comparison */
  companyCountryId: number | null;
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
  companyCountryId: null,
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
  merged.companyCountryId = parseCompanyCountryId(merged.companyCountryId);

  return merged;
}

function parseCompanyCountryId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

async function resolveCompanyCountryIdFromDb(
  organizationId: string,
  companyName: string,
  storedCountryId: number | null,
): Promise<number | null> {
  if (storedCountryId != null) return storedCountryId;

  const companies = await prisma.company.findMany({
    where: { organizationId },
    select: { id: true, name: true, countryId: true },
    orderBy: { id: "asc" },
  });
  if (companies.length === 0) return null;

  const trimmed = companyName.trim().toLowerCase();
  const matched =
    trimmed.length > 0
      ? companies.find((c) => c.name.trim().toLowerCase() === trimmed)
      : undefined;
  const row = matched ?? (companies.length === 1 ? companies[0] : null);
  return row?.countryId ?? null;
}

/** Sync Company.countryId (and related fields) from app preferences for deployment logic. */
export async function syncCompanyRecordsFromAppSettings(
  organizationId: string,
  settings: AppSettings,
): Promise<void> {
  const companies = await prisma.company.findMany({
    where: { organizationId },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });
  if (companies.length === 0) return;

  const trimmedName = settings.companyName.trim().toLowerCase();
  let ids: number[];
  if (trimmedName.length > 0) {
    ids = companies
      .filter((c) => c.name.trim().toLowerCase() === trimmedName)
      .map((c) => c.id);
  } else if (companies.length === 1) {
    const only = companies[0];
    if (!only) return;
    ids = [only.id];
  } else {
    ids = [];
  }
  if (ids.length === 0) return;
  const countryId = settings.companyCountryId;

  await prisma.company.updateMany({
    where: { id: { in: ids } },
    data: {
      countryId,
    },
  });
}

export async function getAppSettings(
  organizationId?: string,
): Promise<AppSettings> {
  const orgId = resolveOrganizationId(organizationId);
  const row = await prisma.settings.findUnique({
    where: { organizationId: orgId },
  });

  const stored = parsePreferencesJson(row?.preferencesJson);
  const merged = mergeAppSettings(stored, row?.language);
  const companyCountryId = await resolveCompanyCountryIdFromDb(
    orgId,
    merged.companyName,
    parseCompanyCountryId(
      (stored as Partial<AppSettings>).companyCountryId ?? merged.companyCountryId,
    ),
  );

  return { ...merged, companyCountryId };
}

export async function saveAppSettings(
  settings: AppSettings,
  organizationId?: string,
): Promise<void> {
  const orgId = resolveOrganizationId(organizationId);
  const language = normalizeLanguage(settings.language);
  const normalized: AppSettings = {
    ...settings,
    companyCountryId: parseCompanyCountryId(settings.companyCountryId),
  };

  await prisma.settings.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      language,
      preferencesJson: JSON.stringify(normalized),
    },
    update: {
      language,
      preferencesJson: JSON.stringify(normalized),
    },
  });

  await syncCompanyRecordsFromAppSettings(orgId, normalized);
}
