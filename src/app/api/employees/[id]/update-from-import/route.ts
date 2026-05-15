/**
 * PUT /api/employees/[id]/update-from-import
 *
 * Updates existing employee from CIM import (duplicate CNP), writes EmployeeHistory,
 * stores PDF as CONTRACT document, sets import status COMPLETED_UPDATE.
 */

import { createSafeAuditLog } from "@/lib/audit";
import { readImportFile } from "@/lib/importStorage";
import { requireAuth, requireRole } from "@/lib/auth";
import { ROLES_EMPLOYEES_RW } from "@/lib/roles";
import {
  isCimPlaceholder,
  parseCimDateToUtcDate,
  utcDateKey,
} from "@/lib/cimImportHelpers";
import { matchCountryId } from "@/lib/countryMatch";
import { hashSha256 } from "@/lib/encryption";
import { isExtractionPlaceholder } from "@/lib/parsers/fieldExtractor";
import { canEditEmployee } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  parseSalaryAmountDecimal,
  salaryAmountToJson,
} from "@/lib/salaryFields";
import { sanitizeFilename, saveFile } from "@/lib/storage";
import { validateEmail, validatePhone } from "@/lib/validation";
import { Prisma } from "@prisma/client";
import fs from "fs/promises";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const MSG = {
  importNotFound: "Import neg\u0103sit",
  employeeNotFound: "Angajat neg\u0103sit",
  cnpMissing: "CNP lips\u0103 \u00een import",
  firmInvalid: "Firm\u0103 invalid\u0103",
  countryUnrecognized:
    "\u021ara din CIM nu a putut fi recunoscut\u0103. Completeaz\u0103 sau corecteaz\u0103 c\xe2mpul.",
  startDateInvalid: "Data \xeenceput activitate invalid\u0103 sau lips\u0103",
  grossInvalid: "Salariu brut invalid sau necompletat \u00een CIM",
  noChanges:
    "Nu exist\u0103 modific\u0103ri de aplicat pentru c\xe2mpurile selectate",
  fileMissing: "Fi\u0219ierul surs\u0103 al importului nu mai este disponibil",
  uniqueConflict: "Email sau alt c\xe2mp unic este deja folosit.",
} as const;

const SELECTABLE = z.enum([
  "position",
  "companyId",
  "workNorm",
  "deploymentCountry",
  "contractStartDate",
  "grossSalary",
  "salaryCurrency",
  "phone",
  "email",
]);

const bodySchema = z.object({
  importId: z.number().int().positive(),
  selectedFields: z.array(SELECTABLE).min(1),
  editedFields: z.record(z.string()),
});

async function getEmployeeId(params: Promise<{ id: string }>): Promise<number> {
  const { id } = await params;
  const n = Number.parseInt(id, 10);
  if (isNaN(n)) throw new Error("Invalid id");
  return n;
}

function historyCode(key: z.infer<typeof SELECTABLE>): string {
  const map: Record<string, string> = {
    position: "function",
    companyId: "company",
    workNorm: "work_norm",
    deploymentCountry: "country",
    contractStartDate: "salary_start",
    grossSalary: "salary",
    salaryCurrency: "salary_currency",
    phone: "phone",
    email: "email",
  };
  return map[key] ?? key;
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_EMPLOYEES_RW,
  );
  if (authError || !user) return authError!;
  if (!canEditEmployee(user.role)) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  try {
    const employeeId = await getEmployeeId(context.params);
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { importId, selectedFields, editedFields } = parsed.data;

    const pending = await prisma.pendingImport.findUnique({
      where: { id: importId },
    });
    if (!pending) {
      return NextResponse.json({ error: MSG.importNotFound }, { status: 404 });
    }
    if (pending.organizationId !== user.organizationId) {
      return NextResponse.json({ error: MSG.importNotFound }, { status: 404 });
    }
    if (!["PENDING", "DRAFT"].includes(pending.status)) {
      return NextResponse.json(
        {
          error: "Importul nu mai poate fi folosit pentru actualizare",
        },
        { status: 409 },
      );
    }

    const extracted = JSON.parse(pending.extractedFields) as Record<
      string,
      { value: string }
    >;
    const cnpFromImport = extracted.cnp?.value?.trim() ?? "";
    if (!cnpFromImport || cnpFromImport.length !== 13) {
      return NextResponse.json({ error: MSG.cnpMissing }, { status: 400 });
    }
    const importHash = hashSha256(cnpFromImport);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        company: { select: { id: true, name: true } },
        country: { select: { id: true, name: true } },
      },
    });
    if (!employee) {
      return NextResponse.json(
        { error: MSG.employeeNotFound },
        { status: 404 },
      );
    }
    if (employee.cnpHash !== importHash) {
      return NextResponse.json(
        {
          error: "CNP-ul din import nu corespunde acestui angajat",
        },
        { status: 403 },
      );
    }

    const countries = await prisma.country.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    const companyIdNew = Number.parseInt(editedFields.companyId ?? "", 10);
    const company = await prisma.company.findFirst({
      where: {
        id: Number.isNaN(companyIdNew) ? -1 : companyIdNew,
        organizationId: employee.organizationId,
      },
      select: { id: true, name: true },
    });
    if (!company) {
      return NextResponse.json({ error: MSG.firmInvalid }, { status: 400 });
    }

    const positionNew = (editedFields.position ?? "").trim();
    const workNormNew = (editedFields.workNorm ?? "").trim();
    const deploymentText = (editedFields.deploymentCountry ?? "").trim();
    const contractRaw = (editedFields.contractStartDate ?? "").trim();
    const grossRaw = (editedFields.grossSalary ?? "").trim();
    const currencyNew = (editedFields.salaryCurrency ?? "").trim() || "RON";
    const phoneNew = (editedFields.phone ?? "").trim();
    const emailNew = (editedFields.email ?? "").trim();

    const countryIdResolved =
      deploymentText &&
      !isExtractionPlaceholder(deploymentText) &&
      !isCimPlaceholder(deploymentText)
        ? matchCountryId(deploymentText, countries)
        : null;

    const contractDate = parseCimDateToUtcDate(contractRaw);
    const grossDecimal =
      grossRaw &&
      !isExtractionPlaceholder(grossRaw) &&
      !isCimPlaceholder(grossRaw)
        ? parseSalaryAmountDecimal(grossRaw.replace(/\s/g, ""))
        : null;

    const updateData: Prisma.EmployeeUpdateInput = {};
    const historyRows: {
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }[] = [];

    const oldCountryId = employee.countryId;
    const oldCountryName = employee.country?.name ?? null;

    for (const field of selectedFields) {
      switch (field) {
        case "position": {
          const oldV = employee.position?.trim() ?? "";
          const newV =
            positionNew && !isExtractionPlaceholder(positionNew)
              ? positionNew
              : "";
          if (oldV === newV) break;
          updateData.position = newV || null;
          historyRows.push({
            field: historyCode(field),
            oldValue: oldV || null,
            newValue: newV || null,
          });
          break;
        }
        case "companyId": {
          if (employee.companyId === company.id) break;
          updateData.company = { connect: { id: company.id } };
          historyRows.push({
            field: historyCode(field),
            oldValue: String(employee.companyId),
            newValue: String(company.id),
          });
          break;
        }
        case "workNorm": {
          const oldV = employee.workNorm?.trim() ?? "";
          const newV =
            workNormNew &&
            !isExtractionPlaceholder(workNormNew) &&
            !isCimPlaceholder(workNormNew)
              ? workNormNew
              : "";
          if (oldV === newV) break;
          updateData.workNorm = newV || null;
          historyRows.push({
            field: historyCode(field),
            oldValue: oldV || null,
            newValue: newV || null,
          });
          break;
        }
        case "deploymentCountry": {
          if (!countryIdResolved) {
            return NextResponse.json(
              { error: MSG.countryUnrecognized },
              { status: 400 },
            );
          }
          if (oldCountryId === countryIdResolved) break;
          updateData.country = { connect: { id: countryIdResolved } };
          const newName =
            countries.find((c) => c.id === countryIdResolved)?.name ??
            String(countryIdResolved);
          historyRows.push({
            field: historyCode(field),
            oldValue: oldCountryName,
            newValue: newName,
          });
          break;
        }
        case "contractStartDate": {
          if (!contractDate) {
            return NextResponse.json(
              { error: MSG.startDateInvalid },
              { status: 400 },
            );
          }
          const oldKey = utcDateKey(
            employee.salaryStartDate ?? employee.hiredAt,
          );
          const newKey = utcDateKey(contractDate);
          if (oldKey === newKey) break;
          updateData.salaryStartDate = contractDate;
          historyRows.push({
            field: historyCode(field),
            oldValue: oldKey,
            newValue: newKey,
          });
          break;
        }
        case "grossSalary": {
          if (!grossDecimal) {
            return NextResponse.json(
              { error: MSG.grossInvalid },
              { status: 400 },
            );
          }
          const oldAmt = salaryAmountToJson(employee.salaryAmount);
          const newAmt = grossDecimal.toNumber();
          if (oldAmt === newAmt) break;
          updateData.salaryAmount = grossDecimal;
          historyRows.push({
            field: historyCode(field),
            oldValue: oldAmt != null ? String(oldAmt) : null,
            newValue: String(newAmt),
          });
          break;
        }
        case "salaryCurrency": {
          const oldCur = (employee.salaryCurrency ?? "RON").trim();
          const newCur = currencyNew.trim() || "RON";
          if (oldCur === newCur) break;
          updateData.salaryCurrency = newCur;
          historyRows.push({
            field: historyCode(field),
            oldValue: oldCur,
            newValue: newCur,
          });
          break;
        }
        case "phone": {
          const oldV = employee.phone?.trim() ?? "";
          const newV =
            phoneNew && !isExtractionPlaceholder(phoneNew) ? phoneNew : "";
          if (oldV === newV) break;
          if (newV && !validatePhone(newV)) {
            return NextResponse.json(
              { error: "Telefon invalid" },
              { status: 400 },
            );
          }
          updateData.phone = newV || null;
          historyRows.push({
            field: historyCode(field),
            oldValue: oldV || null,
            newValue: newV || null,
          });
          break;
        }
        case "email": {
          const oldV = employee.email?.trim() ?? "";
          const newV =
            emailNew && !isExtractionPlaceholder(emailNew) ? emailNew : "";
          if (oldV === newV) break;
          if (newV && !validateEmail(newV)) {
            return NextResponse.json(
              { error: "Email invalid" },
              { status: 400 },
            );
          }
          updateData.email = newV || null;
          historyRows.push({
            field: historyCode(field),
            oldValue: oldV || null,
            newValue: newV || null,
          });
          break;
        }
      }
    }

    if (historyRows.length === 0) {
      return NextResponse.json(
        { error: "NO_CHANGES", message: MSG.noChanges },
        { status: 409 },
      );
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = await readImportFile(pending.filePath);
    } catch {
      return NextResponse.json({ error: MSG.fileMissing }, { status: 400 });
    }

    const safeOriginal = sanitizeFilename(pending.fileName);
    const { relativePath } = await saveFile(
      employeeId,
      "CONTRACT",
      safeOriginal,
      fileBuffer,
    );

    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employeeId },
        data: updateData,
      });

      await tx.document.create({
        data: {
          organizationId: employee.organizationId,
          employeeId,
          type: "CONTRACT",
          number: null,
          fileName: safeOriginal,
          storagePath: relativePath,
          fileSize: fileBuffer.length,
          mimeType: pending.mimeType,
          status: "PENDING",
        },
      });

      await tx.employeeHistory.createMany({
        data: historyRows.map((row) => ({
          employeeId,
          field: row.field,
          oldValue: row.oldValue,
          newValue: row.newValue,
          source: "import_CIM",
        })),
      });

      await tx.pendingImport.update({
        where: { id: importId },
        data: {
          status: "COMPLETED_UPDATE",
          employeeId,
          extractedFields: pending.extractedFields,
        },
      });
    });

    void createSafeAuditLog({
      action: "UPDATE",
      entity: "Employee",
      entityId: employeeId,
      userId: user.userId,
      userName: user.email,
      userRole: user.role,
      newValues: JSON.stringify({
        source: "import_CIM",
        importId,
        fields: historyRows.map((h) => h.field),
      }),
    });

    return NextResponse.json({
      message: "Angajat actualizat",
      employeeId,
      importId,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: MSG.uniqueConflict }, { status: 409 });
    }
    console.error("[EMPLOYEE_UPDATE_FROM_IMPORT]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
