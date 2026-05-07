/**
 * GET  /api/deployments
 * Filtre: employeeId, country (un cod), countries (coduri separate prin virgulă),
 * status, active=true (criteriu KPI).
 * Paginare: trimite `page` și/sau `limit` (implicit page=1, limit=50, max 200).
 * Fără `page`/`limit` în query — returnează toate rândurile care respectă filtrele (ex. timeline).
 * Răspuns: deployments, total, page, limit, totalPages.
 *
 * POST /api/deployments — Creare cu validare overlap
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { activeDeploymentKpiWhere } from "@/lib/activeDeployments";
import { requireAuth } from "@/lib/auth";
import { canEditEmployee } from "@/lib/permissions";
import {
  isValidCountryCode,
  isValidDeploymentStatus,
  getCountryName,
  DEPLOYMENT_COUNTRIES,
  DEPLOYMENT_STATUSES,
} from "@/lib/countries";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function logAudit(
  action: string,
  entityId: number,
  newValues: unknown,
  ipAddress?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity: "Deployment",
        entityId,
        newValues: JSON.stringify(newValues),
        ipAddress: ipAddress ?? null,
      },
    });
  } catch (e) {
    console.error("[AUDIT_LOG]", e);
  }
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Verifică overlap: un angajat nu poate avea 2 detașări ACTIVE simultan.
 * PLANNED poate coexista cu ACTIVE. CANCELLED e ignorat.
 */
async function checkOverlap(
  employeeId: number,
  startDate: Date,
  endDate: Date | null,
  status: string,
  excludeId?: number
): Promise<string | null> {
  // Doar ACTIVE blochează overlap
  if (status !== "ACTIVE") return null;

  const where: Record<string, unknown> = {
    employeeId,
    status: "ACTIVE",
    id: excludeId ? { not: excludeId } : undefined,
  };

  const existing = await prisma.deployment.findMany({
    where,
    select: { id: true, startDate: true, endDate: true, country: true },
  });

  for (const dep of existing) {
    // Verifică overlap de date
    const depEnd = dep.endDate ?? new Date("2099-12-31");
    const newEnd = endDate ?? new Date("2099-12-31");

    // Overlap: [start1, end1] intersectează [start2, end2]
    if (startDate <= depEnd && dep.startDate <= newEnd) {
      return `Angajatul are deja o detașare ACTIVE în ${getCountryName(
        dep.country
      )} (${new Date(dep.startDate).toLocaleDateString("ro-RO")} – ${
        dep.endDate
          ? new Date(dep.endDate).toLocaleDateString("ro-RO")
          : "prezent"
      })`;
    }
  }

  return null;
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;

    const employeeIdRaw = searchParams.get("employeeId");
    const country = searchParams.get("country");
    const countriesCsv = searchParams.get("countries");
    const status = searchParams.get("status");
    const active = searchParams.get("active"); // "true" = același criteriu ca dashboard / stats (activeDeploymentKpiWhere)

    const usePagination =
      searchParams.has("page") || searchParams.has("limit");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10))
    );
    const skip = (page - 1) * limit;

    const at = new Date();
    const filters: Prisma.DeploymentWhereInput[] = [];

    if (employeeIdRaw) {
      const eid = parseInt(employeeIdRaw, 10);
      if (!Number.isNaN(eid)) {
        filters.push({ employeeId: eid });
      }
    }

    if (countriesCsv) {
      const codes = countriesCsv
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((c) => isValidCountryCode(c));
      if (codes.length === 1) {
        filters.push({ country: codes[0] });
      } else if (codes.length > 1) {
        filters.push({ country: { in: codes } });
      }
    } else if (country && isValidCountryCode(country)) {
      filters.push({ country: country.toUpperCase() });
    }

    if (status && isValidDeploymentStatus(status)) {
      filters.push({ status });
    }

    if (active === "true") {
      filters.push(activeDeploymentKpiWhere(at));
    }

    const where: Prisma.DeploymentWhereInput =
      filters.length === 0 ? {} : filters.length === 1 ? filters[0]! : { AND: filters };

    const queryArgs = {
      where,
      orderBy: { startDate: "desc" as const },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            cnp: true,
            position: true,
          },
        },
      },
    };

    const [deployments, total] = await Promise.all([
      prisma.deployment.findMany({
        ...queryArgs,
        ...(usePagination ? { skip, take: limit } : {}),
      }),
      prisma.deployment.count({ where }),
    ]);

    const totalPages = usePagination
      ? Math.ceil(total / limit) || (total > 0 ? 1 : 0)
      : 1;

    return NextResponse.json(
      {
        deployments,
        total,
        page: usePagination ? page : 1,
        limit: usePagination ? limit : total,
        totalPages,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DEPLOYMENTS_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────

const createSchema = z.object({
  employeeId: z.number().int().positive(),
  country: z.string().length(2),
  city: z.string().max(100).nullable().optional(),
  externalCompany: z.string().max(200).nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  status: z.string(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request, [
    "ADMIN",
    "OPERATOR",
  ]);
  if (authError || !user) return authError!;
  if (!canEditEmployee(user.role)) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // ─── Validări ────────────────────────────────────────────────

    // Țară validă
    if (!isValidCountryCode(data.country)) {
      return NextResponse.json(
        {
          error: "COUNTRY_INVALID",
          message: `Țară invalidă. Valide: ${DEPLOYMENT_COUNTRIES.map((c) => c.code).join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Status valid
    if (!isValidDeploymentStatus(data.status)) {
      return NextResponse.json(
        {
          error: "STATUS_INVALID",
          message: `Status invalid. Valide: ${DEPLOYMENT_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Employee există și e activ
    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
      select: { id: true, firstName: true, lastName: true, status: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "EMPLOYEE_NOT_FOUND", message: "Angajat negăsit" },
        { status: 404 }
      );
    }

    if (employee.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "EMPLOYEE_INACTIVE", message: "Angajatul nu mai este activ" },
        { status: 400 }
      );
    }

    // Parse date
    const startDate = new Date(data.startDate);
    const endDate = data.endDate ? new Date(data.endDate) : null;

    // startDate < endDate
    if (endDate && startDate >= endDate) {
      return NextResponse.json(
        {
          error: "DATE_INVALID",
          message: "Data de început trebuie să fie înainte de data de sfârșit",
        },
        { status: 400 }
      );
    }

    // Overlap check
    const overlapError = await checkOverlap(
      data.employeeId,
      startDate,
      endDate,
      data.status
    );

    if (overlapError) {
      return NextResponse.json(
        { error: "OVERLAP", message: overlapError },
        { status: 409 }
      );
    }

    // ─── Salvare ─────────────────────────────────────────────────

    const deployment = await prisma.deployment.create({
      data: {
        employeeId: data.employeeId,
        country: data.country.toUpperCase(),
        city: data.city ?? null,
        startDate,
        endDate,
        status: data.status,
        notes: data.notes ?? null,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
          },
        },
      },
    });

    await logAudit(
      "CREATE",
      deployment.id,
      {
        country: deployment.country,
        employeeId: deployment.employeeId,
        startDate: deployment.startDate,
      },
      getClientIp(request)
    );

    return NextResponse.json(
      { deployment },
      { status: 201 }
    );
  } catch (error) {
    console.error("[DEPLOYMENTS_POST]", error);
    return NextResponse.json(
      { error: "Eroare server intern" },
      { status: 500 }
    );
  }
}
