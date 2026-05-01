/**
 * GET  /api/employees     — Listă paginată cu filtre avansate + masking
 * POST /api/employees     — Creare angajat cu validare + criptare + duplicate check
 *
 * Filtre suportate:
 *   search, status (multi), companyId (multi), country, expiredDocumentType,
 *   expiringSoon, hireDateFrom/To, hasAssignment, sortBy, sortOrder, page, limit
 *
 * Protejat: orice rol autentificat pentru GET; ADMIN/OPERATOR pentru POST.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canEditEmployee, canViewIban } from "@/lib/permissions";
import {
  validateCNP,
  validateIBAN,
  validateEmail,
  validatePhone,
  maskCNP,
  maskIBAN,
} from "@/lib/validation";
import { encrypt, hashSha256 } from "@/lib/encryption";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maskEmployee(emp: Record<string, unknown>, canSeeIban: boolean) {
  return {
    ...emp,
    cnp: maskCNP(String(emp.cnp ?? "")),
    iban: canSeeIban && emp.iban ? maskIBAN(emp.iban as string) : null,
    cnpEncrypted: undefined,
    cnpHash: undefined,
    ibanHash: undefined,
  };
}

async function logAudit(
  action: string,
  entity: string,
  entityId: number | null,
  newValues: unknown,
  ipAddress?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        newValues: JSON.stringify(newValues),
        ipAddress: ipAddress ?? null,
      },
    });
  } catch (e) {
    console.error("[AUDIT_LOG] Failed:", e);
  }
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Select explicit pentru listă — include câmpuri salariale + relații minime */
const employeeListSelect = {
  id: true,
  firstName: true,
  lastName: true,
  cnp: true,
  seriesCI: true,
  numberCI: true,
  email: true,
  phone: true,
  iban: true,
  bankName: true,
  position: true,
  status: true,
  address: true,
  city: true,
  country: true,
  hiredAt: true,
  observations: true,
  salaryType: true,
  salaryAmount: true,
  salaryCurrency: true,
  salaryStartDate: true,
  createdAt: true,
  company: { select: { id: true, name: true } },
  documents: {
    select: { id: true, type: true, status: true, expiryDate: true },
  },
  deployments: {
    where: {
      status: { not: "CANCELLED" },
    },
    select: { id: true, country: true, city: true, startDate: true, endDate: true, status: true },
    orderBy: { startDate: "desc" },
    take: 3,
  },
  _count: { select: { documents: true, deployments: true } },
} satisfies Prisma.EmployeeSelect;

// ─── GET /api/employees ──────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);

    const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "15", 10)));
    const search = searchParams.get("search")?.trim();
    const statusFilter = searchParams.get("status"); // "ACTIVE,TERMINATED"
    const companyFilter = searchParams.get("company"); // "1,2,3"
    const countryFilter = searchParams.get("country"); // "NL,DE"
    const expiredDocType = searchParams.get("expiredDocumentType"); // "A1|MEDICAL|CONTRACT|ANY"
    const expiringSoon = searchParams.get("expiringSoon") === "true";
    const hireDateFrom = searchParams.get("hireDateFrom");
    const hireDateTo = searchParams.get("hireDateTo");
    const hasAssignment = searchParams.get("hasAssignment");
    const sortBy = searchParams.get("sortBy") ?? "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    // Construiește AND array pentru filtre compuse
    const andConditions: Prisma.EmployeeWhereInput[] = [];

    // ─── Search text ──────────────────────────────────────────
    if (search) {
      const isCnpSearch = /^\d{13}$/.test(search);
      if (isCnpSearch) {
        andConditions.push({ cnpHash: hashSha256(search) });
      } else {
        andConditions.push({
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
          ],
        });
      }
    }

    // ─── Status multi ─────────────────────────────────────────
    if (statusFilter) {
      const statuses = statusFilter.split(",").filter(Boolean);
      if (statuses.length > 0) {
        andConditions.push({ status: { in: statuses } });
      }
    }

    // ─── Company multi ────────────────────────────────────────
    if (companyFilter) {
      const companyIds = companyFilter.split(",").map(Number).filter(Boolean);
      if (companyIds.length > 0) {
        andConditions.push({ companyId: { in: companyIds } });
      }
    }

    // ─── Hire date range ──────────────────────────────────────
    if (hireDateFrom || hireDateTo) {
      const hiredAtFilter: Record<string, Date> = {};
      if (hireDateFrom) hiredAtFilter.gte = new Date(hireDateFrom);
      if (hireDateTo) hiredAtFilter.lte = new Date(hireDateTo);
      andConditions.push({ hiredAt: hiredAtFilter });
    }

    // ─── Has active assignment ────────────────────────────────
    // Pentru hasAssignment, filtrăm pe baza existenței unui deployment activ
    let employeeIdsWithAssignment: number[] | null = null;
    if (hasAssignment === "true") {
      const today = new Date();
      const deps = await prisma.deployment.findMany({
        where: {
          status: "ACTIVE",
          OR: [{ endDate: null }, { endDate: { gte: today } }],
          ...(countryFilter
            ? { country: { in: countryFilter.split(",").filter(Boolean) } }
            : {}),
        },
        select: { employeeId: true },
        distinct: ["employeeId"],
      });
      employeeIdsWithAssignment = deps.map((d) => d.employeeId);
      if (employeeIdsWithAssignment.length === 0) {
        // Niciun angajat cu detașare activă
        return NextResponse.json({ data: [], total: 0, page, totalPages: 0 });
      }
      andConditions.push({ id: { in: employeeIdsWithAssignment } });
    }

    // ─── Expired documents ────────────────────────────────────
    let employeeIdsWithExpiredDoc: number[] | null = null;
    if (expiredDocType) {
      const today = new Date();
      const docWhere: Record<string, unknown> = {
        status: "EXPIRED",
      };
      if (expiredDocType !== "ANY") {
        docWhere.type = expiredDocType;
      }
      const docs = await prisma.document.findMany({
        where: docWhere,
        select: { employeeId: true },
        distinct: ["employeeId"],
      });
      employeeIdsWithExpiredDoc = docs.map((d) => d.employeeId);
      if (employeeIdsWithExpiredDoc.length === 0) {
        return NextResponse.json({ data: [], total: 0, page, totalPages: 0 });
      }
      andConditions.push({ id: { in: employeeIdsWithExpiredDoc } });
    }

    // ─── Expiring soon documents ──────────────────────────────
    if (expiringSoon) {
      const docs = await prisma.document.findMany({
        where: { status: "EXPIRING_SOON" },
        select: { employeeId: true },
        distinct: ["employeeId"],
      });
      const ids = docs.map((d) => d.employeeId);
      if (ids.length === 0) {
        return NextResponse.json({ data: [], total: 0, page, totalPages: 0 });
      }
      andConditions.push({ id: { in: ids } });
    }

    // ─── Construiește where final ─────────────────────────────
    const where: Prisma.EmployeeWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    // Sortare validă
    const validSortFields = ["firstName", "lastName", "createdAt", "hiredAt", "status"];
    const orderBy: Prisma.EmployeeOrderByWithRelationInput = validSortFields.includes(sortBy)
      ? { [sortBy]: sortOrder }
      : { createdAt: sortOrder as "asc" | "desc" };

    // ─── Query ────────────────────────────────────────────────
    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: employeeListSelect,
      }),
      prisma.employee.count({ where }),
    ]);

    const canSeeIban = canViewIban(user.role);
    const maskedEmployees = employees.map((e) =>
      maskEmployee(
        {
          id: e.id,
          firstName: e.firstName,
          lastName: e.lastName,
          cnp: e.cnp,
          seriesCI: e.seriesCI,
          numberCI: e.numberCI,
          email: e.email,
          phone: e.phone,
          iban: e.iban,
          bankName: e.bankName,
          position: e.position,
          status: e.status,
          address: e.address,
          city: e.city,
          country: e.country,
          hiredAt: e.hiredAt,
          observations: e.observations,
          salaryType: e.salaryType,
          salaryAmount: e.salaryAmount,
          salaryCurrency: e.salaryCurrency,
          salaryStartDate: e.salaryStartDate,
          company: e.company,
          documents: e.documents,
          deployments: e.deployments,
          documentCount: e._count.documents,
          deploymentCount: e._count.deployments,
          createdAt: e.createdAt,
        },
        canSeeIban
      )
    );

    return NextResponse.json({
      data: maskedEmployees,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[EMPLOYEES_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}

// ─── POST /api/employees ─────────────────────────────────────────────────────

const createSchema = z.object({
  cnp: z.string().trim().min(1, "CNP obligatoriu"),
  firstName: z.string().trim().min(1, "Prenume obligatoriu").max(100),
  lastName: z.string().trim().min(1, "Nume obligatoriu").max(100),
  seriesCI: z.string().max(10).nullable().optional(),
  numberCI: z.string().max(20).nullable().optional(),
  email: z.string().max(255).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  iban: z.string().max(34).nullable().optional(),
  bankName: z.string().max(100).nullable().optional(),
  position: z.string().max(100).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  country: z.string().max(2).default("RO"),
  status: z.string().max(20).default("ACTIVE"),
  observations: z.string().max(1000).nullable().optional(),
  salaryType: z.enum(["LUNAR", "SAPTAMANAL", "ORA"]).nullable().optional(),
  salaryAmount: z.coerce.number().nonnegative().nullable().optional(),
  salaryCurrency: z.string().max(10).default("RON").nullable().optional(),
  salaryStartDate: z.string().trim().min(1).nullable().optional(),
  companyId: z.number().int().positive(),
});

function parseSalaryStartDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

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
    const warnings: string[] = [];

    const normalizedCnp = data.cnp.trim();

    const cnpHash = hashSha256(normalizedCnp);
    const existing = await prisma.employee.findFirst({
      where: { cnpHash },
      select: { id: true, firstName: true, lastName: true, cnp: true, status: true },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: "DUPLICATE_CNP",
          existingEmployeeId: existing.id,
          existing: {
            id: existing.id,
            name: `${existing.firstName} ${existing.lastName}`,
            cnp: maskCNP(existing.cnp),
            status: existing.status,
          },
        },
        { status: 409 }
      );
    }

    if (!validateCNP(normalizedCnp)) {
      warnings.push("CNP are format invalid, dar a fost salvat ca valoare brută.");
    }

    const normalizedEmail = data.email?.trim() || null;
    const normalizedPhone = data.phone?.trim() || null;
    const normalizedIban = data.iban?.trim().toUpperCase() || null;

    const safeEmail =
      normalizedEmail && !validateEmail(normalizedEmail)
        ? (warnings.push("Email invalid ignorat."), null)
        : normalizedEmail;
    const safePhone =
      normalizedPhone && !validatePhone(normalizedPhone)
        ? (warnings.push("Telefon invalid ignorat."), null)
        : normalizedPhone;
    const safeIban =
      normalizedIban && !validateIBAN(normalizedIban)
        ? (warnings.push("IBAN invalid ignorat."), null)
        : normalizedIban;
    const normalizedSalaryCurrency = data.salaryCurrency?.trim().toUpperCase() || "RON";
    const salaryStartDate = parseSalaryStartDate(data.salaryStartDate);

    const cnpEncrypted = encrypt(normalizedCnp);
    const ibanEncrypted = safeIban ? encrypt(safeIban) : null;
    const ibanHash = safeIban ? hashSha256(safeIban) : null;

    const createData: Prisma.EmployeeCreateInput = {
      cnp: normalizedCnp,
      cnpEncrypted,
      cnpHash,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      seriesCI: data.seriesCI,
      numberCI: data.numberCI,
      email: safeEmail,
      phone: safePhone,
      iban: ibanEncrypted,
      ibanHash,
      bankName: data.bankName,
      position: data.position,
      address: data.address,
      city: data.city,
      country: data.country,
      status: data.status,
      salaryType: data.salaryType ?? null,
      salaryAmount: data.salaryAmount ?? null,
      salaryCurrency: normalizedSalaryCurrency,
      salaryStartDate,
      observations: data.observations,
      company: { connect: { id: data.companyId } },
    };

    const employee = await prisma.employee.create({
      data: createData,
      include: { company: { select: { id: true, name: true } } },
    });

    await logAudit("CREATE", "Employee", employee.id, data, getClientIp(request));

    return NextResponse.json(
      { id: employee.id, firstName: employee.firstName, lastName: employee.lastName,
        warnings,
        cnp: maskCNP(employee.cnp), company: employee.company, status: employee.status, createdAt: employee.createdAt },
      { status: 201 }
    );
  } catch (error) {
    console.error("[EMPLOYEES_POST]", error);
    return NextResponse.json({ error: "Eroare server intern" }, { status: 500 });
  }
}
