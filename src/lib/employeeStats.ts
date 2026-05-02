import { prisma } from "@/lib/prisma";
import { equivalentMonthlyGrossToRon } from "@/lib/salaryCostRon";

/**
 * KPI angajați — aceeași logică ca panoul de control și `/api/employees/stats`.
 * Sursă unică: `prisma.employee` + agregare salarii activi cu `salaryAmount`.
 */
export type EmployeeKpiStats = {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  monthlySalaryCostRon: number;
  monthlySalaryEmployeeCount: number;
  monthlySalaryPredominantCurrency: string;
};

export async function getEmployeeStats(): Promise<EmployeeKpiStats> {
  const [totalEmployees, activeEmployees, rows] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.employee.findMany({
      where: {
        status: "ACTIVE",
        salaryAmount: { not: null },
      },
      select: { salaryAmount: true, salaryCurrency: true, salaryType: true },
    }),
  ]);

  let sumRon = 0;
  const currencyCounts = new Map<string, number>();
  for (const e of rows) {
    sumRon += equivalentMonthlyGrossToRon(
      e.salaryAmount,
      e.salaryType != null ? String(e.salaryType) : null,
      e.salaryCurrency
    );
    const c = (e.salaryCurrency ?? "RON").trim().toUpperCase() || "RON";
    currencyCounts.set(c, (currencyCounts.get(c) ?? 0) + 1);
  }
  let predominant = "RON";
  let best = 0;
  for (const [c, n] of currencyCounts) {
    if (n > best) {
      best = n;
      predominant = c;
    }
  }

  return {
    totalEmployees,
    activeEmployees,
    inactiveEmployees: Math.max(0, totalEmployees - activeEmployees),
    monthlySalaryCostRon: Math.round(sumRon * 100) / 100,
    monthlySalaryEmployeeCount: rows.length,
    monthlySalaryPredominantCurrency: predominant,
  };
}
