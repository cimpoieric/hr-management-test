import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getAppSettings } from "@/lib/appSettings";

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
      salaryAgg,
      salaryCurrencyAgg,
      deploymentsByCountryRaw,
      recentAuditRaw,
    ] = await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({ where: { status: "ACTIVE" } }),
      prisma.deployment.count({ where: { status: "ACTIVE" } }),
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
      prisma.employee.aggregate({
        where: {
          salaryType: "LUNAR",
          status: "ACTIVE",
          salaryAmount: { not: null },
        },
        _sum: { salaryAmount: true },
        _count: { _all: true },
      }),
      prisma.employee.groupBy({
        by: ["salaryCurrency"],
        where: {
          salaryType: "LUNAR",
          status: "ACTIVE",
          salaryAmount: { not: null },
        },
        _count: { _all: true },
        orderBy: { _count: { salaryCurrency: "desc" } },
        take: 1,
      }),
      prisma.deployment.groupBy({
        by: ["country"],
        where: { status: "ACTIVE" },
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
      detail: `${item.entity}${item.entityId ? ` #${item.entityId}` : ""}${item.userName ? ` · ${item.userName}` : ""}`,
      createdAt: item.createdAt,
    }));

    const deploymentsByCountry = deploymentsByCountryRaw.map((item) => ({
      country: item.country,
      code: item.country,
      count: item._count._all,
    }));
    const predominantSalaryCurrency = salaryCurrencyAgg[0]?.salaryCurrency ?? "RON";

    return NextResponse.json({
      stats: {
        totalEmployees,
        activeEmployees,
        inactiveEmployees: Math.max(0, totalEmployees - activeEmployees),
        activeDeployments,
        expiredDocuments,
        expiringSoonDocuments,
        pendingImports,
        monthlySalaryCost:
          salaryAgg._sum.salaryAmount != null
            ? salaryAgg._sum.salaryAmount.toNumber()
            : 0,
        monthlySalaryEmployeeCount: salaryAgg._count._all ?? 0,
        monthlySalaryCurrency: predominantSalaryCurrency,
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
