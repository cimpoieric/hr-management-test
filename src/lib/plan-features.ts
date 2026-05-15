/**
 * Feature flags aliniate cu Plan.features din DB (seed / planCatalog).
 */

export const FEATURES = {
  BASIC_REPORTS: "basic_reports",
  EXPORT_EXCEL: "export_excel",
  EMAIL_SUPPORT: "email_support",
  PAYROLL_SLIPS: "payroll_slips",
  EXPORT_PDF: "export_pdf",
  AUTO_BACKUP: "auto_backup",
  PRIORITY_SUPPORT: "priority_support",
  API_ACCESS: "api_access",
  CUSTOM_BRANDING: "custom_branding",
  ADVANCED_REPORTS: "advanced_reports",
  PHONE_SUPPORT: "phone_support",
  UNLIMITED: "all",
} as const;

export type PlanFeature = (typeof FEATURES)[keyof typeof FEATURES];

export type PlanName = "STARTER" | "BUSINESS" | "ENTERPRISE" | "CUSTOM";

export type SubscriptionStatus = "active" | "trial" | "expired";
