import { prisma } from "@/lib/prisma";
import {
  activeDeploymentKpiWhere,
  getActiveDeploymentsCount,
} from "@/lib/activeDeployments";

export type DeploymentCountryCount = {
  country: string;
  code: string;
  count: number;
};

/**
 * KPI detașări — același `activeDeploymentKpiWhere` ca panou, stats bar, `?active=true`.
 * `byCountry` = primele 6 țări după număr (afișare grafic); `activeCount` = total real.
 */
export async function getDeploymentStats(at: Date = new Date()) {
  const [activeCount, raw] = await Promise.all([
    getActiveDeploymentsCount(prisma, at),
    prisma.deployment.groupBy({
      by: ["country"],
      where: activeDeploymentKpiWhere(at),
      _count: { _all: true },
      orderBy: { _count: { country: "desc" } },
      take: 6,
    }),
  ]);

  const byCountry: DeploymentCountryCount[] = raw.map((item) => ({
    country: item.country,
    code: item.country,
    count: item._count._all,
  }));

  return { activeCount, byCountry };
}
