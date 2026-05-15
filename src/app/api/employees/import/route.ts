/**
 * POST /api/employees/import
 *
 * Import bulk angajați (max 500 per cerere).
 * Protejat: ADMIN sau OPERATOR.
 * Moduri: preview (simulare) sau commit (scriere în DB).
 */

import { ROLES_EMPLOYEES_RW } from "@/lib/roles";
import { dedupeEmployee } from "@/lib/dedupe";
import { encrypt, hashSha256 } from "@/lib/encryption";
import { canApproveImport } from "@/lib/permissions";
import { checkCanAddEmployees, checkPlan } from "@/lib/middleware/plan-check";
import { incrementOrganizationEmployeeCount } from "@/lib/organizationPlan";
import { prismaTyped } from "@/lib/prisma";
import { validateCNP, validateIBAN } from "@/lib/validation";
import type { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const importRowSchema = z.object({
  cnp: z.string().regex(/^[0-9]{13}$/, "CNP invalid"),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  iban: z.string().max(34).nullable().optional(),
  bankName: z.string().max(100).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  countryId: z.number().int().positive().nullable().optional(),
  companyId: z.number().int().positive(),
});

const importSchema = z.object({
  mode: z.enum(["preview", "commit"]).default("preview"),
  items: z.array(importRowSchema).min(1).max(500),
});

export type ImportRowResult =
  | {
      index: number;
      cnp: string;
      result: "CREATED" | "UPDATED";
      employeeId: number;
      confidence: number;
      message: string;
    }
  | {
      index: number;
      cnp: string;
      result: "REVIEW_REQUIRED" | "ERROR";
      confidence: number | null;
      message: string;
      diff: { field: string; old: string | null; new: string | null }[] | null;
      existing: { id: number; firstName: string; lastName: string } | null;
    };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = importSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Payload invalid", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { mode, items } = parsed.data;

    const authCheck = await checkPlan(request, { roles: ROLES_EMPLOYEES_RW });
    if (!authCheck.allowed) return authCheck.response;
    const { user } = authCheck;

    if (!canApproveImport(user.role)) {
      return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
    }

    const results: ImportRowResult[] = [];

    const allCnps = items.map((i) => i.cnp);
    const existingEmployees = await prismaTyped.employee.findMany({
      where: { cnp: { in: allCnps } },
    });

    const existingByCnp = new Map(existingEmployees.map((e) => [e.cnp, e]));

    if (mode === "commit") {
      let newEmployeeCount = 0;
      for (const item of items) {
        const existing = existingByCnp.get(item.cnp) ?? null;
        const dedupe = dedupeEmployee(existing, {
          firstName: item.firstName,
          lastName: item.lastName,
          email: item.email,
          phone: item.phone,
          iban: item.iban,
          bankName: item.bankName,
          address: item.address,
          city: item.city,
        });
        if (dedupe.action === "CREATE") newEmployeeCount += 1;
      }
      if (newEmployeeCount > 0) {
        const limitCheck = await checkCanAddEmployees(request, newEmployeeCount, {
          roles: ROLES_EMPLOYEES_RW,
        });
        if (!limitCheck.allowed) return limitCheck.response;
      }
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;

      const existing = existingByCnp.get(item.cnp) ?? null;

      try {
        if (!validateCNP(item.cnp)) {
          results.push({
            index: i,
            cnp: item.cnp,
            result: "ERROR",
            confidence: null,
            message: "CNP invalid",
            diff: null,
            existing: null,
          });
          continue;
        }
        if (item.iban && !validateIBAN(item.iban)) {
          results.push({
            index: i,
            cnp: item.cnp,
            result: "ERROR",
            confidence: null,
            message: "IBAN invalid",
            diff: null,
            existing: null,
          });
          continue;
        }

        const dedupe = dedupeEmployee(existing, {
          firstName: item.firstName,
          lastName: item.lastName,
          email: item.email,
          phone: item.phone,
          iban: item.iban,
          bankName: item.bankName,
          address: item.address,
          city: item.city,
        });

        if (dedupe.action === "CREATE") {
          if (mode === "commit") {
            const cnpHash = hashSha256(item.cnp);
            const cnpEncrypted = encrypt(item.cnp);
            const ibanEncrypted = item.iban ? encrypt(item.iban) : null;
            const ibanHash = item.iban ? hashSha256(item.iban) : null;

            const created = await prismaTyped.employee.create({
              data: {
                organizationId: user.organizationId,
                cnp: item.cnp,
                cnpEncrypted,
                cnpHash,
                firstName: item.firstName,
                lastName: item.lastName,
                email: item.email ?? null,
                phone: item.phone ?? null,
                iban: ibanEncrypted,
                ibanHash,
                bankName: item.bankName ?? null,
                address: item.address ?? null,
                city: item.city ?? null,
                companyId: item.companyId,
                ...(item.countryId != null
                  ? { countryId: item.countryId }
                  : {}),
              } as unknown as Prisma.EmployeeUncheckedCreateInput,
            });
            await incrementOrganizationEmployeeCount(
              prismaTyped,
              user.organizationId,
            );
            results.push({
              index: i,
              cnp: item.cnp,
              result: "CREATED",
              employeeId: created.id,
              confidence: dedupe.confidence,
              message: "Angajat creat cu succes",
            });
          } else {
            results.push({
              index: i,
              cnp: item.cnp,
              result: "CREATED",
              employeeId: -1,
              confidence: dedupe.confidence,
              message: "[PREVIEW] Se va CREA angajat nou",
            });
          }
          continue;
        }

        if (dedupe.action === "UPDATE") {
          if (mode === "commit") {
            const ibanEncrypted = item.iban ? encrypt(item.iban) : null;
            const ibanHash = item.iban ? hashSha256(item.iban) : null;

            const updated = await prismaTyped.employee.update({
              where: { id: existing!.id },
              data: {
                firstName: item.firstName,
                lastName: item.lastName,
                email: item.email ?? null,
                phone: item.phone ?? null,
                iban: ibanEncrypted,
                ibanHash,
                bankName: item.bankName ?? null,
                address: item.address ?? null,
                city: item.city ?? null,
                companyId: item.companyId,
                countryId: item.countryId ?? null,
              } as unknown as Prisma.EmployeeUncheckedUpdateInput,
            });
            results.push({
              index: i,
              cnp: item.cnp,
              result: "UPDATED",
              employeeId: updated.id,
              confidence: dedupe.confidence,
              message: "Angajat actualizat (match > 80%)",
            });
          } else {
            results.push({
              index: i,
              cnp: item.cnp,
              result: "UPDATED",
              employeeId: existing!.id,
              confidence: dedupe.confidence,
              message: "[PREVIEW] Se va ACTUALIZA angajat existent",
            });
          }
          continue;
        }

        results.push({
          index: i,
          cnp: item.cnp,
          result: "REVIEW_REQUIRED",
          confidence: dedupe.confidence,
          message: dedupe.message ?? "Verificare manuala necesara",
          diff: dedupe.diff,
          existing: {
            id: dedupe.existing!.id,
            firstName: dedupe.existing!.firstName,
            lastName: dedupe.existing!.lastName,
          },
        });
      } catch (rowError) {
        results.push({
          index: i,
          cnp: item.cnp,
          result: "ERROR",
          confidence: null,
          message:
            rowError instanceof Error ? rowError.message : "Eroare necunoscuta",
          diff: null,
          existing: null,
        });
      }
    }

    const stats = {
      total: items.length,
      created: results.filter((r) => r.result === "CREATED").length,
      updated: results.filter((r) => r.result === "UPDATED").length,
      review: results.filter((r) => r.result === "REVIEW_REQUIRED").length,
      errors: results.filter((r) => r.result === "ERROR").length,
      mode,
    };

    return NextResponse.json({ stats, results }, { status: 200 });
  } catch (error) {
    console.error("[IMPORT_POST]", error);
    return NextResponse.json(
      { error: "Eroare server intern" },
      { status: 500 },
    );
  }
}
