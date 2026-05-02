import "server-only";

import { prisma } from "@/lib/prisma";

/** Detașare în curs: status ACTIVE și fără dată de sfârșit sau sfârșit în viitor. */
export async function employeeHasActiveDeployment(
  employeeId: number
): Promise<boolean> {
  const now = new Date();
  const row = await prisma.deployment.findFirst({
    where: {
      employeeId,
      status: "ACTIVE",
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    select: { id: true },
  });
  return row != null;
}
