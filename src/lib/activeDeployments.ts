import type { Prisma } from "@prisma/client";

/**
 * Criteriu unic pentru „detașare activă” în KPI (dashboard, stats bar).
 * Aliniat la `status: "ACTIVE"` din Prisma — același filtru ca lista fără `active=true`.
 */
export const activeDeploymentKpiWhere: Prisma.DeploymentWhereInput = {
  status: "ACTIVE",
};
