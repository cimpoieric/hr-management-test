import { prisma } from "@/lib/prisma";
import { equivalentMonthlyGrossToRon } from "@/lib/salaryCostRon";

/**
 * KPI angajați — aceeași logică ca panoul de control și `/api/employees/stats`.
 * Cost lunar: agregare Prisma `groupBy` (sumă pe tip + monedă), fără încărcare linie cu linie.
 */
export type EmployeeKpiStats = {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  monthlySalaryCostRon: number;
  monthlySalaryEmployeeCount: number;
  monthlySalaryPredominantCurrency: string;
};

const salaryWhere = {
  status: "ACTIVE" as const,
  salaryAmount: { not: null },
};

export async function getEmployeeStats(): Promise<EmployeeKpiStats> {
  const [totalEmployees, activeEmployees, monthlySalaryEmployeeCount, groups] =
    await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({ where: { status: "ACTIVE" } }),
      prisma.employee.count({ where: salaryWhere }),
      prisma.employee.groupBy({
        by: ["salaryType", "salaryCurrency"],
        where: salaryWhere,
        _sum: { salaryAmount: true },
        _count: { _all: true },
      }),
    ]);

  let sumRon = 0;
  let predominant = "RON";
  let bestCount = 0;

  for (const g of groups) {
    const sumAmount = g._sum.salaryAmount;
    if (sumAmount != null) {
      sumRon += equivalentMonthlyGrossToRon(
        sumAmount,
        g.salaryType != null ? String(g.salaryType) : null,
        g.salaryCurrency,
      );
    }

    const c = (g.salaryCurrency ?? "RON").trim().toUpperCase() || "RON";
    const n = g._count._all;
    if (n > bestCount) {
      bestCount = n;
      predominant = c;
    }
  }

  return {
    totalEmployees,
    activeEmployees,
    inactiveEmployees: Math.max(0, totalEmployees - activeEmployees),
    monthlySalaryCostRon: Math.round(sumRon * 100) / 100,
    monthlySalaryEmployeeCount,
    monthlySalaryPredominantCurrency: predominant,
  };
}
