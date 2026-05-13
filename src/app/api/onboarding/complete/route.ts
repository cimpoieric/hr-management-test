import { requireOrgAdmin } from "@/lib/auth";
import { runApi } from "@/lib/apiErrorResponse";
import { Errors } from "@/lib/errors";
import { encrypt, hashSha256 } from "@/lib/encryption";
import { prismaTyped as prisma } from "@/lib/prisma";
import {
  parseSalaryAmountDecimal,
  parseSalaryTypeInput,
} from "@/lib/salaryFields";
import { validateIBAN, validatePhone } from "@/lib/validation";
import type { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const departmentEnum = z.enum([
  "HR",
  "IT",
  "Sales",
  "Marketing",
  "Operations",
  "Finance",
  "Other",
]);

const weekdayEnum = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

const bodySchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  position: z.string().trim().max(100).optional().nullable(),
  department: departmentEnum,
  phone: z.string().trim().max(30).optional().nullable(),
  cnp: z.string().trim().min(1).max(64),
  address: z.string().trim().max(500).optional().nullable(),
  emergencyContact: z.string().trim().max(500).optional().nullable(),
  bankAccount: z.string().trim().max(34).optional().nullable(),
  bankName: z.string().trim().max(100).optional().nullable(),
  workStart: z.string().regex(/^\d{2}:\d{2}$/),
  workEnd: z.string().regex(/^\d{2}:\d{2}$/),
  workdays: z.array(weekdayEnum).min(1),
  lateToleranceMinutes: z.coerce.number().int().min(0).max(240),
});

async function getOrCreateDefaultCompany(
  organizationId: string,
  orgName: string,
): Promise<number> {
  const existing = await prisma.company.findFirst({
    where: { organizationId },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  let ro = await prisma.country.findFirst({
    where: { code: "RO" },
    select: { id: true },
  });
  if (!ro) {
    ro = await prisma.country.create({
      data: { code: "RO", name: "Romania" },
      select: { id: true },
    });
  }

  const company = await prisma.company.create({
    data: {
      organizationId,
      name: orgName.trim() || "Main office",
      countryId: ro.id,
      status: "Activ",
    },
    select: { id: true },
  });
  return company.id;
}

export async function POST(request: NextRequest) {
  return runApi(request, async () => {
    const { user, response: authError } = await requireOrgAdmin(request);
    if (authError || !user) {
      if (authError) return authError;
      throw Errors.UNAUTHORIZED;
    }

    const existingCount = await prisma.employee.count({
      where: { organizationId: user.organizationId },
    });
    if (existingCount > 0) {
      throw Errors.ONBOARDING_ALREADY;
    }

    const raw: unknown = await request.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      throw parsed.error;
    }
    const d = parsed.data;

    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { id: true, name: true },
    });
    if (!org) {
      throw Errors.NOT_FOUND;
    }

    const companyId = await getOrCreateDefaultCompany(org.id, org.name);

    const normalizedCnp = d.cnp.trim();
    const cnpHash = hashSha256(normalizedCnp);
    const dup = await prisma.employee.findFirst({
      where: { cnpHash },
      select: { id: true },
    });
    if (dup) {
      throw Errors.CNP_DUPLICATE;
    }

    const normalizedPhone = d.phone?.trim() || null;
    const safePhone =
      normalizedPhone && !validatePhone(normalizedPhone)
        ? null
        : normalizedPhone;

    const normalizedIban = d.bankAccount?.trim().toUpperCase() || null;
    const safeIban =
      normalizedIban && !validateIBAN(normalizedIban) ? null : normalizedIban;

    const obsLines: string[] = [`Department: ${d.department}`];
    if (d.emergencyContact?.trim()) {
      obsLines.push(`Emergency contact: ${d.emergencyContact.trim()}`);
    }
    const observations = obsLines.join("\n");

    const roCountry = await prisma.country.findFirst({
      where: { code: "RO" },
      select: { id: true },
    });

    const cnpEncrypted = encrypt(normalizedCnp);
    const ibanEncrypted = safeIban ? encrypt(safeIban) : null;
    const ibanHash = safeIban ? hashSha256(safeIban) : null;

    const normalizedSalaryType = parseSalaryTypeInput("LUNAR");
    const normalizedSalaryAmount = parseSalaryAmountDecimal(null);
    const salaryAmountForCreate: string | undefined =
      normalizedSalaryAmount !== null
        ? normalizedSalaryAmount.toString()
        : undefined;

    const attendancePayload = {
      workStart: d.workStart,
      workEnd: d.workEnd,
      workdays: d.workdays,
      lateToleranceMinutes: d.lateToleranceMinutes,
    };
    const attendanceJson = JSON.stringify(attendancePayload);

    await prisma.$transaction(async (tx) => {
      await tx.employee.create({
        data: {
          organizationId: org.id,
          companyId,
          cnp: normalizedCnp,
          cnpEncrypted,
          cnpHash,
          firstName: d.firstName.trim(),
          lastName: d.lastName.trim(),
          phone: safePhone,
          position: d.position?.trim() || null,
          address: d.address?.trim() || null,
          city: null,
          countryId: roCountry?.id ?? null,
          observations,
          iban: ibanEncrypted,
          ibanHash,
          bankName: d.bankName?.trim() || null,
          status: "ACTIVE",
          salaryType:
            normalizedSalaryType as Prisma.EmployeeUncheckedCreateInput["salaryType"],
          salaryAmount:
            salaryAmountForCreate as Prisma.EmployeeUncheckedCreateInput["salaryAmount"],
          salaryCurrency: "RON",
          email: null,
        },
      });

      await tx.settings.upsert({
        where: { organizationId: org.id },
        create: {
          organizationId: org.id,
          attendanceSettingsJson: attendanceJson,
        },
        update: {
          attendanceSettingsJson: attendanceJson,
        },
      });
    });

    return NextResponse.json({ success: true }, { status: 201 });
  });
}
