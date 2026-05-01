/**
 * GET    /api/import/pending/[id]  — Detalii PendingImport
 * POST   /api/import/pending/[id]  — Aprobare: salvează în Employee
 * DELETE /api/import/pending/[id]  — Respingere: șterge record + mută fișier
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canEditEmployee } from "@/lib/permissions";
import { encrypt, hashSha256 } from "@/lib/encryption";
import { validateCNP, validateIBAN, maskCNP } from "@/lib/validation";
import { calculateStatus as calcDocStatus } from "@/lib/documentStatus";

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

    // Verifică duplicat CNP
    const extractedFields = JSON.parse(pending.extractedFields) as Record<string, { value: string; confidence: number }>;
    const cnp = extractedFields.cnp?.value ?? "";
    let duplicateEmployee = null;

    if (cnp && cnp.length === 13) {
      const cnpHash = hashSha256(cnp);
      duplicateEmployee = await prisma.employee.findFirst({
        where: { cnpHash },
        select: { id: true, firstName: true, lastName: true, cnp: true, status: true },
      });
    }

    return NextResponse.json({
      id: pending.id,
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
          }
        : null,
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
  const { user, response: authError } = await requireAuth(request, [
    "ADMIN",
    "OPERATOR",
  ]);
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
      await prisma.pendingImport.update({
        where: { id: importId },
        data: { status: "DRAFT", extractedFields: JSON.stringify(editedFields) },
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
    const iban = editedFields.iban?.trim();
    const ibanEncrypted = iban ? encrypt(iban) : null;
    const ibanHash = iban ? hashSha256(iban) : null;

    // ─── Creează Employee ────────────────────────────────────────
    const companyId = parseInt(editedFields.companyId ?? "1", 10);

    const employee = await prisma.employee.create({
      data: {
        cnp,
        cnpEncrypted,
        cnpHash,
        firstName: editedFields.firstName?.trim() ?? "",
        lastName: editedFields.lastName?.trim() ?? "",
        seriesCI: editedFields.seriesCI?.trim() || null,
        numberCI: editedFields.numberCI?.trim() || null,
        email: editedFields.email?.trim() || null,
        phone: editedFields.phone?.trim() || null,
        iban: ibanEncrypted,
        ibanHash,
        bankName: editedFields.bankName?.trim() || null,
        position: editedFields.position?.trim() || null,
        address: editedFields.address?.trim() || null,
        city: editedFields.city?.trim() || null,
        country: "RO",
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
  const { user, response: authError } = await requireAuth(request, [
    "ADMIN",
    "OPERATOR",
  ]);
  if (authError || !user) return authError!;

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

    // Mută fișierul în rejected/
    try {
      const rejectedDir = "./data/import/rejected";
      await fs.mkdir(rejectedDir, { recursive: true });
      const rejectedPath = path.join(rejectedDir, `${Date.now()}_${pending.fileName}`);
      await fs.rename(pending.filePath, rejectedPath);
    } catch {
      // Dacă fișierul nu mai există, continuă
    }

    // Șterge din DB
    await prisma.pendingImport.delete({ where: { id: importId } });

    return NextResponse.json({ message: "Import respins", id: importId });
  } catch (error) {
    console.error("[IMPORT_REJECT]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
