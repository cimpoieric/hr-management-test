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
import { normalizeImportEmployeeRow } from "@/lib/parsers/importEmployeeNormalize";
import { spreadsheetImportItemToEmployeeData } from "@/lib/parsers/employeeImportWrite";
import {
  ensureCompaniesForSheetNames,
  resolveCompanyIdForImportRow,
} from "@/lib/services/companyFromSheet";
import { validateCNP, validateIBAN } from "@/lib/validation";
import type { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida (YYYY-MM-DD)")
  .nullable()
  .optional();

const emptyableName = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => {
    const t = String(v ?? "").trim();
    if (!t || t === "\u2014" || t === "-" || t.toUpperCase() === "N/A") {
      return "";
    }
    return t;
  });

const importRowSchema = z.object({
  cnp: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => String(v ?? "").replace(/\D/g, "")),
  firstName: emptyableName,
  lastName: emptyableName,
  email: z.union([z.string(), z.null()]).optional(),
  phone: z.string().max(20).nullable().optional(),
  iban: z.string().max(34).nullable().optional(),
  bankName: z.string().max(100).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  countryId: z.number().int().positive().nullable().optional(),
  companyId: z.number().int().positive(),
  position: z.string().max(100).nullable().optional(),
  observations: z.string().max(1000).nullable().optional(),
  workNorm: z.string().max(100).nullable().optional(),
  seriesCI: z.string().max(10).nullable().optional(),
  numberCI: z.string().max(20).nullable().optional(),
  status: z.enum(["ACTIVE", "TERMINATED"]).optional(),
  hiredAt: isoDateSchema,
  salaryType: z.enum(["ORA", "LUNAR", "SAPTAMANAL"]).nullable().optional(),
  salaryAmount: z.number().finite().nonnegative().nullable().optional(),
  salaryCurrency: z.string().max(10).nullable().optional(),
  paymentFrequency: z.enum(["weekly", "monthly"]).nullable().optional(),
  salaryStartDate: isoDateSchema,
  sourceSheet: z.string().max(100).nullable().optional(),
});

const importSchema = z.object({
  mode: z.enum(["preview", "commit"]).default("preview"),
  items: z.array(importRowSchema).min(1).max(500),
  /** Creează/găsește firme după numele foii Excel (HTC, BAKKER, …). */
  createCompaniesFromSheets: z.boolean().optional().default(false),
  /** Firmă pentru rânduri fără sourceSheet sau foaie nerecunoscută. */
  fallbackCompanyId: z.number().int().positive().optional(),
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

    const { mode, items, createCompaniesFromSheets, fallbackCompanyId } =
      parsed.data;

    const authCheck = await checkPlan(request, { roles: ROLES_EMPLOYEES_RW });
    if (!authCheck.allowed) return authCheck.response;
    const { user } = authCheck;

    if (!canApproveImport(user.role)) {
      return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
    }

    const results: ImportRowResult[] = [];

    const lookupCnps = items
      .map((i) => String(i.cnp ?? "").replace(/\D/g, ""))
      .filter((c) => c.length === 13 && validateCNP(c));
    const existingEmployees =
      lookupCnps.length > 0
        ? await prismaTyped.employee.findMany({
            where: { cnp: { in: lookupCnps } },
          })
        : [];

    const existingByCnp = new Map(existingEmployees.map((e) => [e.cnp, e]));

    const fallbackId = fallbackCompanyId ?? items[0]?.companyId ?? 1;
    let companyIdBySheetKey = new Map<string, number>();
    let companiesSummary: {
      existing: string[];
      created: string[];
      missing: string[];
    } | null = null;

    if (createCompaniesFromSheets) {
      const sheetNames = items
        .map((i) => i.sourceSheet)
        .filter(
          (s): s is string => typeof s === "string" && s.trim().length > 0,
        );
      const ensure = await ensureCompaniesForSheetNames(
        user.organizationId,
        sheetNames,
        { createMissing: mode === "commit" },
      );
      companyIdBySheetKey = ensure.companyIdBySheetKey;
      companiesSummary = {
        existing: ensure.existing,
        created: ensure.created,
        missing: ensure.missing,
      };
    }

    const companyCache = new Map<number, { id: number; name: string } | null>();

    function resolveRowCompanyId(item: (typeof items)[number]): number {
      return createCompaniesFromSheets
        ? resolveCompanyIdForImportRow(
            item.sourceSheet,
            fallbackId,
            companyIdBySheetKey,
          )
        : item.companyId;
    }

    if (mode === "commit") {
      let newEmployeeCount = 0;
      for (let j = 0; j < items.length; j++) {
        const planItem = items[j];
        if (!planItem) continue;
        const planNorm = normalizeImportEmployeeRow(
          planItem,
          j,
          user.organizationId,
        );
        const existing = planNorm.cnpIsValid
          ? (existingByCnp.get(planNorm.cnp) ?? null)
          : null;
        const dedupe = dedupeEmployee(existing, {
          firstName: planNorm.firstName,
          lastName: planNorm.lastName,
          email: planItem.email,
          phone: planItem.phone,
          iban: planItem.iban,
          bankName: planItem.bankName,
          address: planItem.address,
          city: planItem.city,
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

      const normalized = normalizeImportEmployeeRow(
        item,
        i,
        user.organizationId,
      );
      const existing = normalized.cnpIsValid
        ? (existingByCnp.get(normalized.cnp) ?? null)
        : null;

      try {
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
          firstName: normalized.firstName,
          lastName: normalized.lastName,
          email: item.email,
          phone: item.phone,
          iban: item.iban,
          bankName: item.bankName,
          address: item.address,
          city: item.city,
        });

        const resolvedCompanyId = resolveRowCompanyId(item);
        const company = await prismaTyped.company.findFirst({
          where: {
            id: resolvedCompanyId,
            organizationId: user.organizationId,
          },
          select: { id: true, name: true },
        });
        if (!company) {
          results.push({
            index: i,
            cnp: item.cnp,
            result: "ERROR",
            confidence: null,
            message: createCompaniesFromSheets
              ? `Firma invalida pentru foaia "${item.sourceSheet ?? "—"}"`
              : "Firma invalida sau inexistenta",
            diff: null,
            existing: null,
          });
          continue;
        }
        companyCache.set(company.id, company);

        const itemResolved = {
          ...item,
          ...normalized,
          firstName: normalized.firstName,
          lastName: normalized.lastName,
          observations: normalized.observations,
          companyId: company.id,
          importStatus: normalized.importStatus,
          missingFields: normalized.missingFields,
        };
        const employeeFields =
          spreadsheetImportItemToEmployeeData(itemResolved);
        const firmSuffix = createCompaniesFromSheets
          ? ` (firma ${company.name})`
          : "";
        const incompleteSuffix =
          normalized.importStatus === "incomplet"
            ? " (import incomplet)"
            : "";
        const cnpStored = normalized.cnpForStorage;

        if (dedupe.action === "CREATE") {
          if (mode === "commit") {
            const cnpHash = hashSha256(cnpStored);
            const cnpEncrypted = encrypt(cnpStored);
            const ibanEncrypted = item.iban ? encrypt(item.iban) : null;
            const ibanHash = item.iban ? hashSha256(item.iban) : null;

            const created = await prismaTyped.employee.create({
              data: {
                organizationId: user.organizationId,
                cnp: cnpStored,
                cnpEncrypted,
                cnpHash,
                ...employeeFields,
                iban: ibanEncrypted,
                ibanHash,
                companyId: itemResolved.companyId,
                ...(itemResolved.countryId != null
                  ? { countryId: itemResolved.countryId }
                  : {}),
              } as unknown as Prisma.EmployeeUncheckedCreateInput,
            });
            await incrementOrganizationEmployeeCount(
              prismaTyped,
              user.organizationId,
            );
            results.push({
              index: i,
              cnp: normalized.cnp || cnpStored,
              result: "CREATED",
              employeeId: created.id,
              confidence: dedupe.confidence,
              message: `Angajat creat cu succes${firmSuffix}${incompleteSuffix}`,
            });
          } else {
            results.push({
              index: i,
              cnp: normalized.cnp || cnpStored,
              result: "CREATED",
              employeeId: -1,
              confidence: dedupe.confidence,
              message: `[PREVIEW] Se va CREA angajat nou${firmSuffix}${incompleteSuffix}`,
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
                ...employeeFields,
                iban: ibanEncrypted,
                ibanHash,
                companyId: itemResolved.companyId,
                countryId: itemResolved.countryId ?? null,
              } as unknown as Prisma.EmployeeUncheckedUpdateInput,
            });
            results.push({
              index: i,
              cnp: normalized.cnp || cnpStored,
              result: "UPDATED",
              employeeId: updated.id,
              confidence: dedupe.confidence,
              message: `Angajat actualizat (match > 80%)${firmSuffix}${incompleteSuffix}`,
            });
          } else {
            results.push({
              index: i,
              cnp: normalized.cnp || cnpStored,
              result: "UPDATED",
              employeeId: existing!.id,
              confidence: dedupe.confidence,
              message: `[PREVIEW] Se va ACTUALIZA angajat existent${firmSuffix}${incompleteSuffix}`,
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

    void logAudit({
      userId: user.userId,
      userEmail: user.email,
      action: "EMPLOYEE_IMPORTED",
      resource: "Employee",
      details: { ...stats, companies: companiesSummary },
      req: request,
    });

    return NextResponse.json(
      { stats, results, companies: companiesSummary },
      { status: 200 },
    );
  } catch (error) {
    console.error("[IMPORT_POST]", error);
    return NextResponse.json(
      { error: "Eroare server intern" },
      { status: 500 },
    );
  }
}
