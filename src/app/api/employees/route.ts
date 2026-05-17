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

import { requireAuth, requireRole } from "@/lib/auth";
import { ROLES_EMPLOYEES_RW } from "@/lib/roles";
import { documentsWhereVisible } from "@/lib/documentVisibility";
import { encrypt, hashSha256 } from "@/lib/encryption";
import { canEditEmployee, canViewIban } from "@/lib/permissions";
import { prisma, prismaTyped } from "@/lib/prisma";
import {
  detachedEmployeeProfileWhere,
  isEmployeeMarkedDetached,
} from "@/lib/detachedEmployee";
import { incrementOrganizationEmployeeCount } from "@/lib/organizationPlan";
import { syncEmployeeDeploymentByCountry } from "@/lib/syncEmployeeDeploymentByCountry";
import { checkCanAddEmployees } from "@/lib/middleware/plan-check";
import {
  parseSalaryAmountDecimal,
  parseSalaryTypeInput,
  salaryAmountToJson,
} from "@/lib/salaryFields";
import {
  maskCNP,
  maskIBAN,
  validateCNP,
  validateEmail,
  validateIBAN,
  validatePhone,
} from "@/lib/validation";
import type { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

/** Body JSON la POST /api/employees — câmpuri opționale, tipuri ca la `JSON.parse`. */
export interface EmployeeFormData {
  cnp?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  seriesCI?: unknown;
  numberCI?: unknown;
  email?: unknown;
  phone?: unknown;
  iban?: unknown;
  bankName?: unknown;
  position?: unknown;
  address?: unknown;
  city?: unknown;
  countryId?: unknown;
  status?: unknown;
  observations?: unknown;
  salaryType?: unknown;
  salaryAmount?: unknown;
  salaryCurrency?: unknown;
  salaryStartDate?: unknown;
  companyId?: unknown;
}

type ValidationIssue = { path: (string | number)[]; message: string };

function issue(path: string, message: string): ValidationIssue {
  return { path: [path], message };
}

function parseRequiredString(
  value: unknown,
  field: string,
  minLen: number,
  maxLen: number,
): { ok: true; value: string } | { ok: false; issues: ValidationIssue[] } {
  if (typeof value !== "string") {
    return { ok: false, issues: [issue(field, "Obligatoriu (text)")] };
  }
  const t = value.trim();
  if (t.length < minLen) {
    return {
      ok: false,
      issues: [issue(field, minLen === 1 ? "Obligatoriu" : "Prea scurt")],
    };
  }
  if (t.length > maxLen) {
    return { ok: false, issues: [issue(field, `Maxim ${maxLen} caractere`)] };
  }
  return { ok: true, value: t };
}

function parseOptionalString(
  value: unknown,
  field: string,
  maxLen: number,
):
  | { ok: true; value: string | null | undefined }
  | { ok: false; issues: ValidationIssue[] } {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "string") {
    return {
      ok: false,
      issues: [issue(field, "Trebuie să fie text sau null")],
    };
  }
  const t = value.trim();
  if (t.length > maxLen) {
    return { ok: false, issues: [issue(field, `Maxim ${maxLen} caractere`)] };
  }
  return { ok: true, value: t === "" ? null : t };
}

interface ValidatedEmployeeCreate {
  cnp: string;
  firstName: string;
  lastName: string;
  seriesCI: string | null | undefined;
  numberCI: string | null | undefined;
  email: string | null | undefined;
  phone: string | null | undefined;
  iban: string | null | undefined;
  bankName: string | null | undefined;
  position: string | null | undefined;
  address: string | null | undefined;
  city: string | null | undefined;
  countryId: number | null;
  status: string;
  observations: string | null | undefined;
  salaryTypeRaw: unknown;
  salaryAmountRaw: unknown;
  salaryCurrencyRaw: unknown;
  salaryStartDateRaw: unknown;
  companyId: number;
}

function parseEmployeeCreateBody(
  raw: unknown,
):
  | { ok: true; data: ValidatedEmployeeCreate }
  | { ok: false; issues: ValidationIssue[] } {
  if (raw === null || typeof raw !== "object") {
    return { ok: false, issues: [issue("body", "Obiect JSON așteptat")] };
  }
  const b = raw as EmployeeFormData;
  const issues: ValidationIssue[] = [];

  const cnp = parseRequiredString(b.cnp, "cnp", 1, 64);
  if (!cnp.ok) issues.push(...cnp.issues);
  const firstName = parseRequiredString(b.firstName, "firstName", 1, 100);
  if (!firstName.ok) issues.push(...firstName.issues);
  const lastName = parseRequiredString(b.lastName, "lastName", 1, 100);
  if (!lastName.ok) issues.push(...lastName.issues);

  const seriesCI = parseOptionalString(b.seriesCI, "seriesCI", 10);
  if (!seriesCI.ok) issues.push(...seriesCI.issues);
  const numberCI = parseOptionalString(b.numberCI, "numberCI", 20);
  if (!numberCI.ok) issues.push(...numberCI.issues);
  const email = parseOptionalString(b.email, "email", 255);
  if (!email.ok) issues.push(...email.issues);
  const phone = parseOptionalString(b.phone, "phone", 20);
  if (!phone.ok) issues.push(...phone.issues);
  const iban = parseOptionalString(b.iban, "iban", 34);
  if (!iban.ok) issues.push(...iban.issues);
  const bankName = parseOptionalString(b.bankName, "bankName", 100);
  if (!bankName.ok) issues.push(...bankName.issues);
  const position = parseOptionalString(b.position, "position", 100);
  if (!position.ok) issues.push(...position.issues);
  const address = parseOptionalString(b.address, "address", 255);
  if (!address.ok) issues.push(...address.issues);
  const city = parseOptionalString(b.city, "city", 100);
  if (!city.ok) issues.push(...city.issues);
  const observations = parseOptionalString(
    b.observations,
    "observations",
    1000,
  );
  if (!observations.ok) issues.push(...observations.issues);

  let countryId: number | null = null;
  if (b.countryId !== undefined && b.countryId !== null) {
    if (
      typeof b.countryId !== "number" ||
      !Number.isInteger(b.countryId) ||
      b.countryId <= 0
    ) {
      issues.push(issue("countryId", "ID țară invalid"));
    } else {
      countryId = b.countryId;
    }
  }

  let status = "ACTIVE";
  if (b.status !== undefined && b.status !== null) {
    if (typeof b.status !== "string") {
      issues.push(issue("status", "Trebuie să fie text"));
    } else {
      const t = b.status.trim();
      if (t.length > 20) issues.push(issue("status", "Maxim 20 caractere"));
      else status = t || "ACTIVE";
    }
  }

  if (
    typeof b.companyId !== "number" ||
    !Number.isInteger(b.companyId) ||
    b.companyId <= 0
  ) {
    issues.push(issue("companyId", "ID firmă invalid (număr întreg pozitiv)"));
  }

  if (b.salaryStartDate !== undefined && b.salaryStartDate !== null) {
    if (typeof b.salaryStartDate !== "string") {
      issues.push(
        issue("salaryStartDate", "Trebuie să fie text (dată) sau gol"),
      );
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    data: {
      cnp: cnp.ok ? cnp.value : "",
      firstName: firstName.ok ? firstName.value : "",
      lastName: lastName.ok ? lastName.value : "",
      seriesCI: seriesCI.ok ? seriesCI.value : undefined,
      numberCI: numberCI.ok ? numberCI.value : undefined,
      email: email.ok ? email.value : undefined,
      phone: phone.ok ? phone.value : undefined,
      iban: iban.ok ? iban.value : undefined,
      bankName: bankName.ok ? bankName.value : undefined,
      position: position.ok ? position.value : undefined,
      address: address.ok ? address.value : undefined,
      city: city.ok ? city.value : undefined,
      countryId,
      status,
      observations: observations.ok ? observations.value : undefined,
      salaryTypeRaw: b.salaryType,
      salaryAmountRaw: b.salaryAmount,
      salaryCurrencyRaw: b.salaryCurrency,
      salaryStartDateRaw: b.salaryStartDate,
      companyId: b.companyId as number,
    },
  };
}

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
  countryId: true,
  country: { select: { id: true, name: true, code: true } },
  hiredAt: true,
  observations: true,
  workNorm: true,
  salaryType: true,
  salaryAmount: true,
  salaryCurrency: true,
  salaryStartDate: true,
  paymentFrequency: true,
  createdAt: true,
  company: { select: { id: true, name: true } },
  documents: {
    where: { deletedAt: null },
    select: { id: true, type: true, status: true, expiryDate: true },
  },
  deployments: {
    where: {
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      country: true,
      city: true,
      startDate: true,
      endDate: true,
      status: true,
    },
    orderBy: { startDate: "desc" },
    take: 3,
  },
  _count: {
    select: {
      documents: { where: { deletedAt: null } },
      deployments: true,
    },
  },
} as unknown as Prisma.EmployeeSelect;

/**
 * Formă așteptată de la `findMany` + `employeeListSelect`.
 * Definită explicit (fără `Prisma.Employee`) ca să rămână stabilă dacă clientul
 * generat e dezaxat față de schema (ex. câmp vechi `country: string` pe model).
 */
interface EmployeeListQueryRow {
  id: number;
  firstName: string;
  lastName: string;
  cnp: string;
  seriesCI: string | null;
  numberCI: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
  bankName: string | null;
  position: string | null;
  status: string;
  address: string | null;
  city: string | null;
  countryId: number | null;
  country: { id: number; name: string; code: string } | null;
  hiredAt: Date;
  observations: string | null;
  workNorm: string | null;
  salaryType: "LUNAR" | "SAPTAMANAL" | "ORA" | null;
  salaryAmount: unknown;
  salaryCurrency: string;
  salaryStartDate: Date | null;
  paymentFrequency: string;
  createdAt: Date;
  company: { id: number; name: string };
  documents: Array<{
    id: number;
    type: string;
    status: string;
    expiryDate: Date | null;
  }>;
  deployments: Array<{
    id: number;
    country: string;
    city: string | null;
    startDate: Date;
    endDate: Date | null;
    status: string;
  }>;
  _count: { documents: number; deployments: number };
}

// ─── GET /api/employees ──────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return (
      authError ??
      NextResponse.json({ error: "Neautentificat" }, { status: 401 })
    );
  }

  try {
    const { searchParams } = request.nextUrl;

    const page = Math.max(
      1,
      Number.parseInt(searchParams.get("page") ?? "1", 10),
    );
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(searchParams.get("limit") ?? "15", 10)),
    );
    const search = searchParams.get("search")?.trim();
    const statusFilter = searchParams.get("status"); // "ACTIVE,TERMINATED"
    const companyFilter = searchParams.get("company"); // "1,2,3"
    const countryFilter = searchParams.get("country"); // detașare: "NL,DE"
    const employeeCountryFilter = searchParams.get("employeeCountry"); // domiciliu: "1,2,3" (id țară)
    const salaryTypeFilter = searchParams.get("salaryType"); // "LUNAR|SAPTAMANAL|ORA"
    const expiredDocType = searchParams.get("expiredDocumentType"); // "A1|MEDICAL|CONTRACT|ANY"
    const expiringSoon = searchParams.get("expiringSoon") === "true";
    const hireDateFrom = searchParams.get("hireDateFrom");
    const hireDateTo = searchParams.get("hireDateTo");
    const hasAssignment = searchParams.get("hasAssignment");
    const detachedOnly = searchParams.get("detachedOnly");
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

    if (employeeCountryFilter) {
      const cids = employeeCountryFilter
        .split(",")
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n) && n > 0);
      if (cids.length > 0) {
        andConditions.push({
          countryId: { in: cids },
        } as Prisma.EmployeeWhereInput);
      }
    }

    // ─── Salary type filter ───────────────────────────────────
    if (salaryTypeFilter) {
      const normalizedSalaryType = parseSalaryTypeInput(salaryTypeFilter);
      if (normalizedSalaryType) {
        andConditions.push({ salaryType: normalizedSalaryType });
      }
    }

    // ─── Hire date range ──────────────────────────────────────
    if (hireDateFrom || hireDateTo) {
      const hiredAtFilter: Record<string, Date> = {};
      if (hireDateFrom) hiredAtFilter.gte = new Date(hireDateFrom);
      if (hireDateTo) hiredAtFilter.lte = new Date(hireDateTo);
      andConditions.push({ hiredAt: hiredAtFilter });
    }

    // ─── Profil marcat detasare (workNorm / position / observations) ──
    if (detachedOnly === "true") {
      andConditions.push(detachedEmployeeProfileWhere);
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
      const docWhere: Prisma.DocumentWhereInput = documentsWhereVisible({
        status: "EXPIRED",
        ...(expiredDocType !== "ANY" ? { type: expiredDocType } : {}),
      });
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
        where: documentsWhereVisible({ status: "EXPIRING_SOON" }),
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
    const validSortFields = [
      "firstName",
      "lastName",
      "createdAt",
      "hiredAt",
      "status",
    ];
    const orderBy: Prisma.EmployeeOrderByWithRelationInput =
      validSortFields.includes(sortBy)
        ? { [sortBy]: sortOrder }
        : { createdAt: sortOrder as "asc" | "desc" };

    // ─── Query ────────────────────────────────────────────────
    const [employeesRaw, total] = await Promise.all([
      prismaTyped.employee.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: employeeListSelect,
      }),
      prismaTyped.employee.count({ where }),
    ]);
    const employees = employeesRaw as unknown as EmployeeListQueryRow[];

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
          countryId: e.countryId,
          country: e.country,
          hiredAt: e.hiredAt,
          observations: e.observations,
          workNorm: e.workNorm,
          isMarkedDetached: isEmployeeMarkedDetached({
            workNorm: e.workNorm,
            position: e.position,
            observations: e.observations,
          }),
          hasActiveDeployment: (e.deployments ?? []).some(
            (d) => d.status === "ACTIVE",
          ),
          salaryType: e.salaryType,
          salaryAmount: salaryAmountToJson(e.salaryAmount),
          salaryCurrency: e.salaryCurrency,
          salaryStartDate: e.salaryStartDate,
          paymentFrequency: e.paymentFrequency?.trim() || "weekly",
          company: e.company,
          documents: e.documents,
          deployments: e.deployments,
          documentCount: e._count.documents,
          deploymentCount: e._count.deployments,
          createdAt: e.createdAt,
        },
        canSeeIban,
      ),
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

function parseSalaryStartDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: NextRequest) {
  const planCheck = await checkCanAddEmployees(request, 1, {
    roles: ROLES_EMPLOYEES_RW,
  });
  if (!planCheck.allowed) return planCheck.response;
  const { user } = planCheck;

  if (!canEditEmployee(user.role)) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  try {
    const rawBody: unknown = await request.json();
    const parsed = parseEmployeeCreateBody(rawBody);

    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const warnings: string[] = [];

    const normalizedCnp = data.cnp;

    const cnpHash = hashSha256(normalizedCnp);
    const existing = await prismaTyped.employee.findFirst({
      where: { cnpHash },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        cnp: true,
        status: true,
      },
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
        { status: 409 },
      );
    }

    if (!validateCNP(normalizedCnp)) {
      warnings.push(
        "CNP are format invalid, dar a fost salvat ca valoare brută.",
      );
    }

    const normalizedEmail =
      typeof data.email === "string" && data.email.trim().length > 0
        ? data.email.trim()
        : null;
    const normalizedPhone =
      typeof data.phone === "string" && data.phone.trim().length > 0
        ? data.phone.trim()
        : null;
    const normalizedIban =
      typeof data.iban === "string" && data.iban.trim().length > 0
        ? data.iban.trim().toUpperCase()
        : null;

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
    const normalizedSalaryType = parseSalaryTypeInput(data.salaryTypeRaw);
    const normalizedSalaryAmount = parseSalaryAmountDecimal(
      data.salaryAmountRaw,
    );
    const normalizedSalaryCurrency =
      typeof data.salaryCurrencyRaw === "string" &&
      data.salaryCurrencyRaw.trim().length > 0
        ? data.salaryCurrencyRaw.trim().toUpperCase()
        : "RON";
    const salaryStartDate =
      typeof data.salaryStartDateRaw === "string"
        ? parseSalaryStartDate(data.salaryStartDateRaw)
        : null;

    const cnpEncrypted = encrypt(normalizedCnp);
    const ibanEncrypted = safeIban ? encrypt(safeIban) : null;
    const ibanHash = safeIban ? hashSha256(safeIban) : null;

    const salaryAmountForCreate: string | undefined =
      normalizedSalaryAmount !== null
        ? normalizedSalaryAmount.toString()
        : undefined;

    const company = await prismaTyped.company.findUnique({
      where: { id: data.companyId },
      select: { id: true, organizationId: true },
    });
    if (!company) {
      return NextResponse.json(
        { error: "Companie invalidă sau inexistentă" },
        { status: 400 },
      );
    }

    const organizationId = String(company.organizationId);

    const createData = {
      organizationId,
      cnp: normalizedCnp,
      cnpEncrypted,
      cnpHash,
      firstName: data.firstName,
      lastName: data.lastName,
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
      countryId: data.countryId ?? null,
      status: data.status,
      salaryType: normalizedSalaryType,
      salaryAmount:
        salaryAmountForCreate as Prisma.EmployeeUncheckedCreateInput["salaryAmount"],
      salaryCurrency: normalizedSalaryCurrency,
      salaryStartDate,
      observations: data.observations,
      companyId: data.companyId,
    } as unknown as Prisma.EmployeeUncheckedCreateInput;

    const employeeCreateInclude = {
      company: { select: { id: true, name: true } },
      country: { select: { id: true, name: true, code: true } },
    } as unknown as Prisma.EmployeeInclude;

    const employee = await prismaTyped.employee.create({
      data: createData,
      include: employeeCreateInclude,
    });

    await incrementOrganizationEmployeeCount(
      prismaTyped,
      user.organizationId,
    );

    const { logAudit } = await import("@/lib/audit");
    void logAudit({
      userId: user.userId,
      userEmail: user.email,
      action: "EMPLOYEE_CREATED",
      resource: "Employee",
      resourceId: employee.id,
      details: { firstName: data.firstName, lastName: data.lastName },
      req: request,
    });

    try {
      await syncEmployeeDeploymentByCountry({
        employeeId: employee.id,
        companyId: data.companyId,
        countryId: employee.countryId,
        hiredAt: employee.hiredAt,
        city: employee.city,
      });
    } catch (deploymentSyncError) {
      console.error(
        "[EMPLOYEES_POST] deployment auto-create failed",
        deploymentSyncError,
      );
    }

    return NextResponse.json(
      {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        warnings,
        cnp: maskCNP(employee.cnp),
        company: employee.company,
        status: employee.status,
        createdAt: employee.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[EMPLOYEES_POST]", error);
    return NextResponse.json(
      { error: "Eroare server intern" },
      { status: 500 },
    );
  }
}
