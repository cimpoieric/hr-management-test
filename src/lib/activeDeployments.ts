import type { Prisma } from "@prisma/client";

/** Client minim (inclusiv instanță Prisma extinsă din `@/lib/prisma`). */
export type DeploymentCountPrisma = {
  deployment: {
    count: (args: { where: Prisma.DeploymentWhereInput }) => Promise<number>;
  };
};

function dayBounds(at: Date) {
  const startOfDay = new Date(at);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(at);
  endOfDay.setHours(23, 59, 59, 999);
  return { startOfDay, endOfDay };
}

/**
 * Criteriu unic pentru „detașare activă” (dashboard, stats, `?active=true`).
 *
 * În DB statusul este `ACTIVE` (UI: „Activă”). O detașare e inclusă dacă nu e anulată și:
 * - status === `ACTIVE`, sau
 * - a început până la sfârșitul zilei de referință și încă nu s-a încheiat (endDate null sau endDate ≥ începutul zilei).
 */
export function activeDeploymentKpiWhere(at: Date = new Date()): Prisma.DeploymentWhereInput {
  const { startOfDay, endOfDay } = dayBounds(at);
  return {
    NOT: { status: "CANCELLED" },
    OR: [
      { status: "ACTIVE" },
      {
        startDate: { lte: endOfDay },
        OR: [{ endDate: null }, { endDate: { gte: startOfDay } }],
      },
    ],
  };
}

/** Număr detașări active (același `where` ca KPI / stats). */
export async function getActiveDeploymentsCount(
  prisma: DeploymentCountPrisma,
  at: Date = new Date()
): Promise<number> {
  return prisma.deployment.count({ where: activeDeploymentKpiWhere(at) });
}
