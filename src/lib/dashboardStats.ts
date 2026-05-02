import { getAppSettings } from "@/lib/appSettings";
import { getEmployeeStats } from "@/lib/employeeStats";
import { getDocumentStats } from "@/lib/documentStats";
import { getDeploymentStats } from "@/lib/deploymentStats";
import { getPendingImportsCount } from "@/lib/importStats";

/** Obiectul `stats` returnat de API — compus din helper-e KPI reutilizabile. */
export type DashboardStatsJson = {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  activeDeployments: number;
  expiredDocuments: number;
  expiringSoonDocuments: number;
  pendingImports: number;
  monthlySalaryCost: number;
  monthlySalaryEmployeeCount: number;
  monthlySalaryCurrency: string;
  monthlySalaryPredominantCurrency: string;
  documentAlertDays: number;
};

export async function getDashboardStats(): Promise<{ stats: DashboardStatsJson }> {
  const now = new Date();
  const settings = await getAppSettings();

  const [emp, doc, dep, pendingImports] = await Promise.all([
    getEmployeeStats(),
    getDocumentStats(now, settings.alertExpiredDocumentsDays),
    getDeploymentStats(now),
    getPendingImportsCount(),
  ]);

  const stats: DashboardStatsJson = {
    totalEmployees: emp.totalEmployees,
    activeEmployees: emp.activeEmployees,
    inactiveEmployees: emp.inactiveEmployees,
    activeDeployments: dep.activeCount,
    expiredDocuments: doc.expiredDocuments,
    expiringSoonDocuments: doc.expiringSoonDocuments,
    pendingImports,
    monthlySalaryCost: emp.monthlySalaryCostRon,
    monthlySalaryEmployeeCount: emp.monthlySalaryEmployeeCount,
    monthlySalaryCurrency: "RON",
    monthlySalaryPredominantCurrency: emp.monthlySalaryPredominantCurrency,
    documentAlertDays: settings.alertExpiredDocumentsDays,
  };

  return { stats };
}
