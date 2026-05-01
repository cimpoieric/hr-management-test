/**
 * GET    /api/employees/[id]  — Detalii complete angajat
 * PUT    /api/employees/[id]  — Actualizare angajat
 * DELETE /api/employees/[id]  — Soft delete (status → TERMINATED)
 *
 * CNP/IBAN decriptate doar pentru rolurile cu permisiune.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  canEditEmployee,
  canDeleteEmployee,
  canViewSensitiveData,
  canViewIban,
} from "@/lib/permissions";
import {
  validateCNP,
  validateIBAN,
  validateEmail,
  validatePhone,
  maskCNP,
  maskIBAN,
} from "@/lib/validation";
import { encrypt, decrypt, hashSha256 } from "@/lib/encryption";
import { logAuditFF } from "@/lib/audit";
import {
  parseSalaryAmountDecimal,
  parseSalaryTypeInput,
  salaryAmountToJson,
} from "@/lib/salaryFields";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ─── Params helper ───────────────────────────────────────────────────────────

// Next.js 15: params is a Promise in dynamic route handlers
async function getId(params: Promise<{ id: string }>): Promise<number> {
  const { id } = await params;
  const num = parseInt(id, 10);
  if (isNaN(num)) throw new Error("ID invalid");
  return num;
}

// ══════════════════════════════════════════════════════════════════════════════
// GET
// ══════════════════════════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const employeeId = await getId(params);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        company: { select: { id: true, name: true, cui: true } },
        documents: {
          select: { id: true, type: true, fileName: true, uploadedAt: true },
        },
        deployments: {
          select: { id: true, country: true, city: true, startDate: true, endDate: true, status: true, notes: true },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "Angajat negăsit" }, { status: 404 });
    }

    // Construiește response în funcție de permisiuni
    const canSeeSensitive = canViewSensitiveData(user.role);
    const canSeeIban = canViewIban(user.role);

    const response: Record<string, unknown> = {
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      seriesCI: employee.seriesCI,
      numberCI: employee.numberCI,
      email: employee.email,
      phone: employee.phone,
      position: employee.position,
      address: employee.address,
      city: employee.city,
      country: employee.country,
      status: employee.status,
      observations: employee.observations,
      salaryType: employee.salaryType,
      salaryAmount: salaryAmountToJson(employee.salaryAmount),
      salaryCurrency: employee.salaryCurrency,
      salaryStartDate: employee.salaryStartDate,
      company: employee.company,
      hiredAt: employee.hiredAt,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
      documents: employee.documents,
      deployments: employee.deployments,
    };

    // CNP: decriptat doar pentru roluri cu permisiune
    if (canSeeSensitive) {
      try {
        response.cnp = decrypt(employee.cnpEncrypted);
        // Audit: vizualizare date sensibile
        logAuditFF({
          action: "VIEW",
          entity: "Employee",
          entityId: employee.id,
          userId: user.userId,
          userRole: user.role,
          ipAddress: getClientIp(request),
          details: "Vizualizare CNP decriptat",
        });
      } catch {
        response.cnp = maskCNP(employee.cnp);
      }
    } else {
      response.cnp = maskCNP(employee.cnp);
    }

    // IBAN: decriptat doar pentru roluri cu permisiune
    if (canSeeIban && employee.iban) {
      try {
        response.iban = decrypt(employee.iban);
        // Audit: vizualizare date sensibile
        logAuditFF({
          action: "VIEW",
          entity: "Employee",
          entityId: employee.id,
          userId: user.userId,
          userRole: user.role,
          ipAddress: getClientIp(request),
          details: "Vizualizare IBAN decriptat",
        });
      } catch {
        response.iban = employee.iban ? maskIBAN(employee.iban) : null;
      }
    } else {
      response.iban = employee.iban ? maskIBAN(employee.iban) : null;
    }

    // BankName doar pentru cei cu permisiune IBAN
    if (!canSeeIban) {
      response.bankName = null;
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[EMPLOYEE_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PUT
// ══════════════════════════════════════════════════════════════════════════════

const updateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  seriesCI: z.string().max(10).nullable().optional(),
  numberCI: z.string().max(20).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  iban: z.string().max(34).nullable().optional(),
  bankName: z.string().max(100).nullable().optional(),
  position: z.string().max(100).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  country: z.string().max(2).optional(),
  status: z.string().max(20).optional(),
  observations: z.string().max(1000).nullable().optional(),
  salaryType: z
    .union([
      z.literal("LUNAR"),
      z.literal("SAPTAMANAL"),
      z.literal("ORA"),
      z.literal(""),
      z.null(),
      z.undefined(),
    ])
    .optional(),
  salaryAmount: z
    .union([z.number(), z.string(), z.literal(""), z.null(), z.undefined()])
    .optional(),
  salaryCurrency: z.string().max(10).nullable().optional(),
  salaryStartDate: z.string().trim().min(1).nullable().optional(),
  companyId: z.number().int().positive().optional(),
});

function parseSalaryStartDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response: authError } = await requireAuth(request, [
    "ADMIN",
    "OPERATOR",
  ]);
  if (authError || !user) return authError!;
  if (!canEditEmployee(user.role)) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  try {
    const employeeId = await getId(params);

    const rawBody: unknown = await request.json();
    const body = rawBody && typeof rawBody === "object" ? rawBody : {};
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verifică existența
    const existing = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Angajat negăsit" }, { status: 404 });
    }

    // ─── Validare email ──────────────────────────────────────────
    if (data.email && !validateEmail(data.email)) {
      return NextResponse.json(
        { error: "EMAIL_INVALID", message: "Email invalid" },
        { status: 400 }
      );
    }

    // ─── Validare telefon ────────────────────────────────────────
    if (data.phone && !validatePhone(data.phone)) {
      return NextResponse.json(
        { error: "PHONE_INVALID", message: "Telefon invalid" },
        { status: 400 }
      );
    }

    // ─── Validare + criptare IBAN ────────────────────────────────
    let ibanEncrypted: string | undefined;
    let ibanHash: string | null | undefined;
    if (data.iban !== undefined) {
      if (data.iban === null) {
        ibanEncrypted = undefined;
        ibanHash = null;
      } else if (data.iban === "") {
        ibanEncrypted = undefined;
        ibanHash = null;
      } else {
        if (!validateIBAN(data.iban)) {
          return NextResponse.json(
            { error: "IBAN_INVALID", message: "IBAN invalid" },
            { status: 400 }
          );
        }
        ibanEncrypted = encrypt(data.iban);
        ibanHash = hashSha256(data.iban);
      }
    }

    // ─── Build update data ───────────────────────────────────────
    const updateData: Prisma.EmployeeUpdateInput = {};

    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.seriesCI !== undefined) updateData.seriesCI = data.seriesCI;
    if (data.numberCI !== undefined) updateData.numberCI = data.numberCI;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.observations !== undefined) updateData.observations = data.observations;
    if (data.salaryType !== undefined) {
      updateData.salaryType =
        data.salaryType === "" || data.salaryType === null
          ? null
          : parseSalaryTypeInput(data.salaryType);
    }
    if (data.salaryAmount !== undefined) {
      const dec = parseSalaryAmountDecimal(data.salaryAmount);
      updateData.salaryAmount =
        dec === null ? null : (dec.toString() as Prisma.EmployeeUpdateInput["salaryAmount"]);
    }
    if (data.salaryCurrency !== undefined) {
      updateData.salaryCurrency = data.salaryCurrency?.trim().toUpperCase() || "RON";
    }
    if (data.salaryStartDate !== undefined) {
      updateData.salaryStartDate = parseSalaryStartDate(data.salaryStartDate);
    }
    if (data.companyId !== undefined) {
      updateData.company = { connect: { id: data.companyId } };
    }
    if (data.bankName !== undefined) updateData.bankName = data.bankName;
    if (ibanEncrypted !== undefined) {
      updateData.iban = ibanEncrypted;
      updateData.ibanHash = ibanHash;
    }

    // ─── Salvare ─────────────────────────────────────────────────
    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: updateData,
      include: { company: { select: { id: true, name: true } } },
    });

    // ─── Audit log (via Prisma middleware + manual fallback) ─────
    logAuditFF({
      action: "UPDATE",
      entity: "Employee",
      entityId: employeeId,
      userId: user.userId,
      userRole: user.role,
      ipAddress: getClientIp(request),
      oldValues: Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      ),
      newValues: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      cnp: maskCNP(updated.cnp),
      company: updated.company,
      status: updated.status,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error("[EMPLOYEE_PUT]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// DELETE (soft delete)
// ══════════════════════════════════════════════════════════════════════════════

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response: authError } = await requireAuth(request, [
    "ADMIN",
    "OPERATOR",
  ]);
  if (authError || !user) return authError!;
  if (!canDeleteEmployee(user.role)) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  try {
    const employeeId = await getId(params);

    const existing = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Angajat negăsit" }, { status: 404 });
    }

    // Soft delete: setează status TERMINATED
    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: { status: "TERMINATED" },
    });

    // Audit log (via Prisma middleware + manual fallback)
    logAuditFF({
      action: "DELETE",
      entity: "Employee",
      entityId: employeeId,
      userId: user.userId,
      userRole: user.role,
      ipAddress: getClientIp(request),
      oldValues: { status: existing.status },
      newValues: { status: "TERMINATED" },
    });

    return NextResponse.json({
      message: "Angajat marcat ca terminat",
      id: updated.id,
      status: updated.status,
    });
  } catch (error) {
    console.error("[EMPLOYEE_DELETE]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
