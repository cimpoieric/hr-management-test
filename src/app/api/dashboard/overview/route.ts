import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getAppSettings } from "@/lib/appSettings";
import { activeDeploymentKpiWhere } from "@/lib/activeDeployments";
import { salaryMonthlyToRon } from "@/lib/salaryCostRon";

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const now = new Date();
    const settings = await getAppSettings();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const expiringDocLimit = new Date(
      now.getTime() + settings.alertExpiredDocumentsDays * 24 * 60 * 60 * 1000
    );

    const [
      totalEmployees,
      activeEmployees,
      activeDeployments,
      expiredDocuments,
      expiringSoonDocuments,
      pendingImports,
      salaryDashboardAgg,
      deploymentsByCountryRaw,
      recentAuditRaw,
    ] = await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({ where: { status: "ACTIVE" } }),
      prisma.deployment.count({ where: activeDeploymentKpiWhere }),
      prisma.document.count({
        where: {
          expiryDate: { not: null, lt: now },
        },
      }),
      prisma.document.count({
        where: {
          expiryDate: {
            not: null,
            gte: now,
            lte: expiringDocLimit,
          },
        },
      }),
      prisma.pendingImport.count({ where: { status: "PENDING" } }),
      prisma.employee
        .findMany({
          where: {
            salaryType: "LUNAR",
            status: "ACTIVE",
            salaryAmount: { not: null },
          },
          select: { salaryAmount: true, salaryCurrency: true },
        })
        .then((rows) => {
          let sumRon = 0;
          const currencyCounts = new Map<string, number>();
          for (const e of rows) {
            sumRon += salaryMonthlyToRon(e.salaryAmount, e.salaryCurrency);
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
            sumRon,
            employeeCount: rows.length,
            predominantCurrency: predominant,
          };
        }),
      prisma.deployment.groupBy({
        by: ["country"],
        where: activeDeploymentKpiWhere,
        _count: { _all: true },
        orderBy: { _count: { country: "desc" } },
        take: 6,
      }),
      prisma.auditLog.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          action: true,
          entity: true,
          userName: true,
          createdAt: true,
          entityId: true,
        },
      }),
    ]);

    const recentActivity = recentAuditRaw.map((item) => ({
      id: item.id,
      action: item.action,
      entity: item.entity,
      entityId: item.entityId,
      userName: item.userName ?? null,
      createdAt: item.createdAt,
    }));

    const deploymentsByCountry = deploymentsByCountryRaw.map((item) => ({
      country: item.country,
      code: item.country,
      count: item._count._all,
    }));
    return NextResponse.json({
      stats: {
        totalEmployees,
        activeEmployees,
        inactiveEmployees: Math.max(0, totalEmployees - activeEmployees),
        activeDeployments,
        expiredDocuments,
        expiringSoonDocuments,
        pendingImports,
        monthlySalaryCost: Math.round(salaryDashboardAgg.sumRon * 100) / 100,
        monthlySalaryEmployeeCount: salaryDashboardAgg.employeeCount,
        monthlySalaryCurrency: "RON",
        monthlySalaryPredominantCurrency: salaryDashboardAgg.predominantCurrency,
        documentAlertDays: settings.alertExpiredDocumentsDays,
      },
      deploymentsByCountry,
      recentActivity,
    });
  } catch (error) {
    console.error("[DASHBOARD_OVERVIEW_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
