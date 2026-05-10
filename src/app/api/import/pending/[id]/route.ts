/**
 * GET    /api/import/pending/[id]  — Detalii PendingImport
 * POST   /api/import/pending/[id]  — Aprobare: salvează în Employee
 * DELETE /api/import/pending/[id]  — Respingere: șterge record + mută fișier
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deletePendingImportRecord } from "@/lib/deletePendingImport";
import { requireAuth, WRITE_ROLES } from "@/lib/auth";
import { canEditEmployee } from "@/lib/permissions";
import { encrypt, hashSha256 } from "@/lib/encryption";
import { validateCNP, maskCNP } from "@/lib/validation";
import { isExtractionPlaceholder } from "@/lib/parsers/fieldExtractor";
import { salaryAmountToJson } from "@/lib/salaryFields";

function importedOptional(value: string | undefined): string | null {
  const t = value?.trim() ?? "";
  if (!t || isExtractionPlaceholder(t)) return null;
  return t;
}

function importedOptionalName(value: string | undefined): string {
  const t = value?.trim() ?? "";
  if (isExtractionPlaceholder(t)) return "";
  return t;
}

/** Citește o valoare string din câmp extras (imbricat) sau din draft plat. */
function readExtractedValue(entry: unknown): string {
  if (entry == null) return "";
  if (typeof entry === "string") return entry.trim();
  if (typeof entry === "object" && "value" in (entry as object)) {
    return String((entry as { value: string }).value ?? "").trim();
  }
  return "";
}

/**
 * Reconciliază `editedFields` cu JSON-ul vechi al importului, păstrând mereu
 * structura { value, confidence } (draft-ul nu poate suprascrie cu obiect plat).
 */
function mergeExtractedWithEdited(
  previousJson: string,
  edited: Record<string, string>
): string {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(previousJson || "{}") as Record<string, unknown>;
  } catch {
    raw = {};
  }
  const keys = new Set([...Object.keys(raw), ...Object.keys(edited)]);
  const out: Record<string, { value: string; confidence: number }> = {};
  for (const key of keys) {
    if (edited[key] !== undefined) {
      const prev = raw[key];
      const conf =
        prev && typeof prev === "object" && prev !== null && "confidence" in prev
          ? Number((prev as { confidence: number }).confidence) || 1
          : 1;
      out[key] = { value: edited[key] ?? "", confidence: conf };
    } else {
      const prev = raw[key];
      if (typeof prev === "string") {
        out[key] = { value: prev, confidence: 1 };
      } else if (prev && typeof prev === "object" && "value" in (prev as object)) {
        out[key] = {
          value: String((prev as { value: string }).value ?? ""),
          confidence: Number((prev as { confidence: number }).confidence) || 0,
        };
      }
    }
  }
  return JSON.stringify(out);
}

function resolveEditedOrStored(
  key: string,
  edited: Record<string, string>,
  storedExtracted: Record<string, unknown>
): string {
  const direct = edited[key]?.trim() ?? "";
  if (direct) return direct;
  return readExtractedValue(storedExtracted[key]);
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return authError ?? NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const importId = parseInt(id, 10);
    if (isNaN(importId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const pending = await prisma.pendingImport.findUnique({
      where: { id: importId },
    });

    if (!pending) {
      return NextResponse.json({ error: "Import negăsit" }, { status: 404 });
    }

    // Verifică duplicat CNP + date pentru comparație (actualizare din CIM)
    const extractedFields = JSON.parse(pending.extractedFields) as Record<string, { value: string; confidence: number }>;
    const cnp = extractedFields.cnp?.value ?? "";
    let duplicateEmployee = null;

    if (cnp && cnp.length === 13) {
      const cnpHash = hashSha256(cnp);
      duplicateEmployee = await prisma.employee.findFirst({
        where: { cnpHash },
        include: {
          company: { select: { id: true, name: true } },
          country: { select: { id: true, name: true } },
        },
      });
    }

    const [companies, countries] = await Promise.all([
      prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.country.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    ]);

    return NextResponse.json({
      id: pending.id,
      employeeId: pending.employeeId,
      fileName: pending.fileName,
      mimeType: pending.mimeType,
      fileSize: pending.fileSize,
      status: pending.status,
      confidenceScore: pending.confidenceScore,
      uncertainFields: JSON.parse(pending.uncertainFields) as string[],
      extractedFields,
      rawText: pending.rawText,
      duplicateEmployee: duplicateEmployee
        ? {
            id: duplicateEmployee.id,
            name: `${duplicateEmployee.lastName} ${duplicateEmployee.firstName}`,
            cnp: maskCNP(duplicateEmployee.cnp),
            status: duplicateEmployee.status,
            position: duplicateEmployee.position,
            companyId: duplicateEmployee.companyId,
            companyName: duplicateEmployee.company.name,
            countryId: duplicateEmployee.countryId,
            countryName: duplicateEmployee.country?.name ?? null,
            workNorm: duplicateEmployee.workNorm,
            salaryAmount: salaryAmountToJson(duplicateEmployee.salaryAmount),
            salaryCurrency: duplicateEmployee.salaryCurrency,
            salaryStartDate: duplicateEmployee.salaryStartDate?.toISOString() ?? null,
            hiredAt: duplicateEmployee.hiredAt.toISOString(),
            phone: duplicateEmployee.phone,
            email: duplicateEmployee.email,
          }
        : null,
      companies,
      countries,
      createdAt: pending.createdAt,
    });
  } catch (error) {
    console.error("[PENDING_IMPORT_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}

// ─── POST (aprobare) ─────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response: authError } = await requireAuth(request, WRITE_ROLES);
  if (authError || !user) return authError!;
  if (!canEditEmployee(user.role)) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const importId = parseInt(id, 10);
    if (isNaN(importId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const pending = await prisma.pendingImport.findUnique({
      where: { id: importId },
    });
    if (!pending) {
      return NextResponse.json({ error: "Import negăsit" }, { status: 404 });
    }

    // Primește datele editate de operator
    const body = await request.json();
    const { fields: editedFields, action } = body as {
      fields: Record<string, string>;
      action: "APPROVE" | "DRAFT";
    };

    if (action === "DRAFT") {
      const mergedJson = mergeExtractedWithEdited(pending.extractedFields, editedFields);
      await prisma.pendingImport.update({
        where: { id: importId },
        data: { status: "DRAFT", extractedFields: mergedJson },
      });
      return NextResponse.json({ message: "Salvat ca draft", id: importId });
    }

    // ─── Validare CNP ────────────────────────────────────────────
    const cnp = editedFields.cnp?.trim() ?? "";
    if (!cnp || !validateCNP(cnp)) {
      return NextResponse.json(
        { error: "CNP_INVALID", message: "CNP invalid sau lipsă" },
        { status: 400 }
      );
    }

    // Verificare duplicat
    const cnpHash = hashSha256(cnp);
    const existing = await prisma.employee.findFirst({
      where: { cnpHash },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: "DUPLICATE_CNP",
          existingEmployeeId: existing.id,
          message: "CNP deja existent în sistem",
        },
        { status: 409 }
      );
    }

    // ─── Criptare date sensibile ─────────────────────────────────
    const cnpEncrypted = encrypt(cnp);
    const ibanRaw = editedFields.iban?.trim() ?? "";
    const iban =
      ibanRaw && !isExtractionPlaceholder(ibanRaw) ? ibanRaw : "";
    const ibanEncrypted = iban ? encrypt(iban) : null;
    const ibanHash = iban ? hashSha256(iban) : null;

    // ─── Creează Employee ────────────────────────────────────────
    const companyId = parseInt(editedFields.companyId ?? "1", 10);
    const countryIdRaw = editedFields.countryId?.trim();
    const countryIdParsed = countryIdRaw ? parseInt(countryIdRaw, 10) : NaN;
    const roDefault = await prisma.country.findFirst({
      where: { code: "RO" },
      select: { id: true },
    });
    const countryId =
      !Number.isNaN(countryIdParsed) && countryIdParsed > 0
        ? countryIdParsed
        : roDefault?.id ?? null;

    let storedExtracted: Record<string, unknown> = {};
    try {
      storedExtracted = JSON.parse(pending.extractedFields || "{}") as Record<string, unknown>;
    } catch {
      storedExtracted = {};
    }

    const employee = await prisma.employee.create({
      data: {
        cnp,
        cnpEncrypted,
        cnpHash,
        firstName: importedOptionalName(resolveEditedOrStored("firstName", editedFields, storedExtracted)),
        lastName: importedOptionalName(resolveEditedOrStored("lastName", editedFields, storedExtracted)),
        seriesCI: importedOptional(editedFields.seriesCI),
        numberCI: importedOptional(editedFields.numberCI),
        email: importedOptional(editedFields.email),
        phone: importedOptional(editedFields.phone),
        iban: ibanEncrypted,
        ibanHash,
        bankName: importedOptional(editedFields.bankName),
        position: importedOptional(editedFields.position),
        address: importedOptional(editedFields.address),
        city: importedOptional(editedFields.city),
        ...(countryId != null ? { countryId } : {}),
        status: "ACTIVE",
        companyId,
      },
    });

    // ─── Marchează importul ca aprobat ──────────────────────────
    await prisma.pendingImport.update({
      where: { id: importId },
      data: { status: "APPROVED", employeeId: employee.id },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "Employee",
        entityId: employee.id,
        newValues: JSON.stringify({ source: "MANUAL_IMPORT", importId }),
      },
    });

    return NextResponse.json(
      {
        message: "Angajat creat",
        employeeId: employee.id,
        importId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[IMPORT_APPROVE]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}

// ─── DELETE (respingere) ─────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response: authError } = await requireAuth(request, WRITE_ROLES);
  if (authError || !user) return authError!;

  try {
    const { id } = await params;
    const importId = parseInt(id, 10);
    if (isNaN(importId)) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const result = await deletePendingImportRecord(importId);
    if (!result.ok && result.kind === "NOT_FOUND") {
      return NextResponse.json({ error: "Import negăsit" }, { status: 404 });
    }
    if (!result.ok) {
      return NextResponse.json({ error: "Eroare server" }, { status: 500 });
    }

    return NextResponse.json({ message: "Import respins", id: importId });
  } catch (error) {
    console.error("[IMPORT_REJECT]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
