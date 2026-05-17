import "server-only";

import { prismaBase, prismaTyped as prisma } from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client";

type DbClient = PrismaClient;

export type SyncEmployeeDeploymentByCountryResult = {
  action: "none" | "created" | "closed";
  created: boolean;
  closedCount: number;
};

/** Normalize country code to 2-letter uppercase (RO, NL, DE). */
export function normalizeCountryCode(
  code: string | null | undefined,
): string | null {
  const raw = String(code ?? "")
    .trim()
    .toUpperCase();
  if (!raw) return null;
  if (raw.length === 2) return raw;
  if (raw.length > 2) return raw.slice(0, 2);
  return null;
}

/**
 * If employee country differs from company country, create ACTIVE Deployment.
 * If they match, close ACTIVE deployments (COMPLETED). Errors are not propagated.
 */
export async function syncEmployeeDeploymentByCountry(params: {
  employeeId: number;
  companyId: number;
  countryId: number | null;
  hiredAt: Date;
  city?: string | null;
  db?: DbClient;
}): Promise<SyncEmployeeDeploymentByCountryResult> {
  const db = params.db ?? prisma;

  if (params.countryId == null) {
    return { action: "none", created: false, closedCount: 0 };
  }

  const [company, employeeCountry] = await Promise.all([
    db.company.findUnique({
      where: { id: params.companyId },
      select: { country: { select: { code: true } } },
    }),
    db.country.findUnique({
      where: { id: params.countryId },
      select: { code: true },
    }),
  ]);

  const companyCode = normalizeCountryCode(company?.country?.code);
  const employeeCode = normalizeCountryCode(employeeCountry?.code);

  if (!employeeCode || !companyCode) {
    return { action: "none", created: false, closedCount: 0 };
  }

  const isForeignDeployment = employeeCode !== companyCode;

  if (!isForeignDeployment) {
    const today = new Date();
    const closed = await db.deployment.updateMany({
      where: {
        employeeId: params.employeeId,
        status: "ACTIVE",
      },
      data: {
        status: "COMPLETED",
        endDate: today,
      },
    });
    return {
      action: closed.count > 0 ? "closed" : "none",
      created: false,
      closedCount: closed.count,
    };
  }

  const existingActive = await db.deployment.findFirst({
    where: {
      employeeId: params.employeeId,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (existingActive) {
    return { action: "none", created: false, closedCount: 0 };
  }

  await db.deployment.create({
    data: {
      employeeId: params.employeeId,
      country: employeeCode,
      city: params.city?.trim() || null,
      startDate: params.hiredAt ?? new Date(),
      endDate: null,
      status: "ACTIVE",
      notes: "Auto: employee country differs from company country",
    },
  });

  return { action: "created", created: true, closedCount: 0 };
}

export type BackfillCountryDeploymentsResult = {
  scanned: number;
  created: number;
  closed: number;
  skipped: number;
};

/** Scan existing employees for one-time backfill (CLI). */
export async function backfillDeploymentsForCountryMismatch(options?: {
  organizationId?: string;
  db?: DbClient;
}): Promise<BackfillCountryDeploymentsResult> {
  const db = options?.db ?? prismaBase;

  const employees = await db.employee.findMany({
    where: {
      status: "ACTIVE",
      countryId: { not: null },
      ...(options?.organizationId
        ? { organizationId: options.organizationId }
        : {}),
    },
    select: {
      id: true,
      companyId: true,
      countryId: true,
      hiredAt: true,
      city: true,
    },
  });

  let created = 0;
  let closed = 0;
  let skipped = 0;

  for (const emp of employees) {
    try {
      const result = await syncEmployeeDeploymentByCountry({
        employeeId: emp.id,
        companyId: emp.companyId,
        countryId: emp.countryId,
        hiredAt: emp.hiredAt,
        city: emp.city,
        db,
      });
      if (result.created) created++;
      else if (result.closedCount > 0) closed += result.closedCount;
      else skipped++;
    } catch (error) {
      skipped++;
      console.error(
        `[backfillDeploymentsForCountryMismatch] employee ${emp.id}`,
        error,
      );
    }
  }

  return {
    scanned: employees.length,
    created,
    closed,
    skipped,
  };
}
