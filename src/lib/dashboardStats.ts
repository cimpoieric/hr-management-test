import {
  DEFAULT_APP_SETTINGS,
  getAppSettings,
} from "@/lib/appSettings";
import { getDeploymentStats } from "@/lib/deploymentStats";
import { getDocumentStats } from "@/lib/documentStats";
import { getEmployeeStats } from "@/lib/employeeStats";
import { getPendingImportsCount } from "@/lib/importStats";
import type { DashboardStats } from "@/types";

/** Obiectul `stats` returnat de API — compus din helper-e KPI reutilizabile. */
export type DashboardStatsJson = DashboardStats;

export const DEFAULT_DASHBOARD_STATS: DashboardStatsJson = {
  totalEmployees: 0,
  activeEmployees: 0,
  inactiveEmployees: 0,
  activeDeployments: 0,
  expiredDocuments: 0,
  expiringSoonDocuments: 0,
  pendingImports: 0,
  monthlySalaryCost: 0,
  monthlySalaryEmployeeCount: 0,
  monthlySalaryCurrency: "RON",
  monthlySalaryPredominantCurrency: "RON",
  documentAlertDays: DEFAULT_APP_SETTINGS.alertExpiredDocumentsDays,
};

export async function getDashboardStats(
  organizationId: string,
): Promise<{
  stats: DashboardStatsJson;
}> {
  try {
    const now = new Date();
    const settings = await getAppSettings(organizationId);
    const alertDays = settings.alertExpiredDocumentsDays || 30;

    const [emp, doc, dep, pendingImports] = await Promise.all([
      getEmployeeStats(),
      getDocumentStats(now, alertDays),
      getDeploymentStats(now),
      getPendingImportsCount(),
    ]);

    const stats: DashboardStatsJson = {
      totalEmployees: emp.totalEmployees || 0,
      activeEmployees: emp.activeEmployees || 0,
      inactiveEmployees: emp.inactiveEmployees || 0,
      activeDeployments: dep.activeCount || 0,
      expiredDocuments: doc.expiredDocuments || 0,
      expiringSoonDocuments: doc.expiringSoonDocuments || 0,
      pendingImports: pendingImports || 0,
      monthlySalaryCost: emp.monthlySalaryCostRon || 0,
      monthlySalaryEmployeeCount: emp.monthlySalaryEmployeeCount || 0,
      monthlySalaryCurrency: "RON",
      monthlySalaryPredominantCurrency:
        emp.monthlySalaryPredominantCurrency || "RON",
      documentAlertDays: alertDays,
    };

    return { stats };
  } catch (error) {
    console.error("[getDashboardStats]", error);
    return { stats: { ...DEFAULT_DASHBOARD_STATS } };
  }
}
