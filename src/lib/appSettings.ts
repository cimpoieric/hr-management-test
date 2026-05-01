import { prisma } from "@/lib/prisma";

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
  language: "ro",
  timezone: "Europe/Bucharest",

  alertExpiredDocumentsDays: 30,
  alertExpiringDeploymentsDays: 7,
  inAppNotificationsEnabled: true,
};

const KEY_TO_FIELD: Record<string, keyof AppSettings> = {
  [APP_SETTING_KEYS.companyName]: "companyName",
  [APP_SETTING_KEYS.companyCuiReg]: "companyCuiReg",
  [APP_SETTING_KEYS.companyAddress]: "companyAddress",
  [APP_SETTING_KEYS.legalRepName]: "legalRepName",
  [APP_SETTING_KEYS.legalRepRole]: "legalRepRole",
  [APP_SETTING_KEYS.companyIban]: "companyIban",
  [APP_SETTING_KEYS.companyBank]: "companyBank",
  [APP_SETTING_KEYS.salaryDefaultCurrency]: "salaryDefaultCurrency",
  [APP_SETTING_KEYS.salaryDefaultType]: "salaryDefaultType",
  [APP_SETTING_KEYS.standardMonthlyHours]: "standardMonthlyHours",
  [APP_SETTING_KEYS.standardWeeklyHours]: "standardWeeklyHours",
  [APP_SETTING_KEYS.dateFormat]: "dateFormat",
  [APP_SETTING_KEYS.language]: "language",
  [APP_SETTING_KEYS.timezone]: "timezone",
  [APP_SETTING_KEYS.alertExpiredDocumentsDays]: "alertExpiredDocumentsDays",
  [APP_SETTING_KEYS.alertExpiringDeploymentsDays]: "alertExpiringDeploymentsDays",
  [APP_SETTING_KEYS.inAppNotificationsEnabled]: "inAppNotificationsEnabled",
};

export async function getAppSettings(): Promise<AppSettings> {
  const records = await prisma.systemConfig.findMany({
    where: { key: { in: Object.values(APP_SETTING_KEYS) } },
  });

  const out: AppSettings = { ...DEFAULT_APP_SETTINGS };
  for (const rec of records) {
    const field = KEY_TO_FIELD[rec.key];
    if (!field) continue;
    if (
      field === "standardMonthlyHours" ||
      field === "standardWeeklyHours" ||
      field === "alertExpiredDocumentsDays" ||
      field === "alertExpiringDeploymentsDays"
    ) {
      const n = Number(rec.value);
      if (!Number.isNaN(n)) (out[field] as number) = n;
      continue;
    }
    if (field === "inAppNotificationsEnabled") {
      out.inAppNotificationsEnabled = rec.value === "true";
      continue;
    }
    (out[field] as string) = rec.value;
  }
  return out;
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const entries: Array<{ key: string; value: string }> = [
    { key: APP_SETTING_KEYS.companyName, value: settings.companyName },
    { key: APP_SETTING_KEYS.companyCuiReg, value: settings.companyCuiReg },
    { key: APP_SETTING_KEYS.companyAddress, value: settings.companyAddress },
    { key: APP_SETTING_KEYS.legalRepName, value: settings.legalRepName },
    { key: APP_SETTING_KEYS.legalRepRole, value: settings.legalRepRole },
    { key: APP_SETTING_KEYS.companyIban, value: settings.companyIban },
    { key: APP_SETTING_KEYS.companyBank, value: settings.companyBank },
    { key: APP_SETTING_KEYS.salaryDefaultCurrency, value: settings.salaryDefaultCurrency },
    { key: APP_SETTING_KEYS.salaryDefaultType, value: settings.salaryDefaultType },
    { key: APP_SETTING_KEYS.standardMonthlyHours, value: String(settings.standardMonthlyHours) },
    { key: APP_SETTING_KEYS.standardWeeklyHours, value: String(settings.standardWeeklyHours) },
    { key: APP_SETTING_KEYS.dateFormat, value: settings.dateFormat },
    { key: APP_SETTING_KEYS.language, value: settings.language },
    { key: APP_SETTING_KEYS.timezone, value: settings.timezone },
    { key: APP_SETTING_KEYS.alertExpiredDocumentsDays, value: String(settings.alertExpiredDocumentsDays) },
    { key: APP_SETTING_KEYS.alertExpiringDeploymentsDays, value: String(settings.alertExpiringDeploymentsDays) },
    { key: APP_SETTING_KEYS.inAppNotificationsEnabled, value: String(settings.inAppNotificationsEnabled) },
  ];

  for (const item of entries) {
    await prisma.systemConfig.upsert({
      where: { key: item.key },
      update: { value: item.value },
      create: { key: item.key, value: item.value },
    });
  }
}
