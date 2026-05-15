import "server-only";

import {
  detachedEmployeeProfileWhere,
  isEmployeeMarkedDetached,
  resolveDeploymentCountryCode,
} from "@/lib/detachedEmployee";
import { prismaBase, prismaTyped as prisma } from "@/lib/prisma";

export type SyncDetachedDeploymentsResult = {
  scanned: number;
  created: number;
  skippedHasActive: number;
  employeeIds: number[];
};

/**
 * Creeaza Deployment ACTIVE pentru angajati marcati detasati in profil
 * dar fara detasare activa in tabelul Deployment.
 */
export async function syncDetachedEmployeesDeployments(options?: {
  /** Pentru scripturi CLI (fara context tenant). */
  organizationId?: string;
}): Promise<SyncDetachedDeploymentsResult> {
  const db = options?.organizationId ? prismaBase : prisma;
  const employees = await db.employee.findMany({
    where: {
      status: "ACTIVE",
      ...(options?.organizationId
        ? { organizationId: options.organizationId }
        : {}),
      ...detachedEmployeeProfileWhere,
    },
    select: {
      id: true,
      hiredAt: true,
      workNorm: true,
      position: true,
      observations: true,
      country: { select: { code: true } },
      deployments: {
        where: { status: { not: "CANCELLED" } },
        select: { id: true, status: true },
      },
    },
  });

  let created = 0;
  let skippedHasActive = 0;
  const employeeIds: number[] = [];

  for (const emp of employees) {
    if (!isEmployeeMarkedDetached(emp)) continue;

    const hasActive = emp.deployments.some((d) => d.status === "ACTIVE");
    if (hasActive) {
      skippedHasActive++;
      continue;
    }

    const country = resolveDeploymentCountryCode(emp.country?.code);
    await db.deployment.create({
      data: {
        employeeId: emp.id,
        country,
        city: null,
        startDate: emp.hiredAt ?? new Date(),
        endDate: null,
        status: "ACTIVE",
        notes: "Auto: sincronizat din profil angajat (detasare)",
      },
    });
    created++;
    employeeIds.push(emp.id);
  }

  return {
    scanned: employees.length,
    created,
    skippedHasActive,
    employeeIds,
  };
}
