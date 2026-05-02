import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getDeploymentStats } from "@/lib/deploymentStats";

/**
 * GET /api/dashboard/overview
 * Context panou: detașări pe țări + activitate recentă.
 * Detașările: `getDeploymentStats` (același total ca `/api/dashboard/stats`).
 */
export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [{ byCountry: deploymentsByCountry }, recentAuditRaw] = await Promise.all([
      getDeploymentStats(now),
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

    return NextResponse.json({
      deploymentsByCountry,
      recentActivity,
    });
  } catch (error) {
    console.error("[DASHBOARD_OVERVIEW_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
