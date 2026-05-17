/**
 * POST /api/documents/upload
 *
 * Upload document: primește FormData cu fișier + metadate.
 * Validează: employee există, tip valid, fișier valid (max 50MB, pdf/jpg/png).
 * Salvează pe disk, creează record DB cu status automat.
 */

import { requireAuth, requireRole } from "@/lib/auth";
import { ROLES_EMPLOYEES_RW } from "@/lib/roles";
import { DOCUMENT_TYPES } from "@/lib/documentConstants";
import { calculateStatus } from "@/lib/documentStatus";
import { canEditEmployee } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  MAX_FILE_SIZE,
  getFileSize,
  getMimeType,
  initStorage,
  isAllowedExtension,
  isAllowedMimeType,
  isValidDocumentType,
  saveFile,
} from "@/lib/storage";
import { type NextRequest, NextResponse } from "next/server";

function parsePositiveIntFormValue(raw: unknown): number | null {
  if (raw == null) return null;
  const s = typeof raw === "string" ? raw.trim() : String(raw).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export async function POST(request: NextRequest) {
  const { user, response: authError } = await requireRole(
    request,
    ROLES_EMPLOYEES_RW,
  );
  if (authError || !user) return authError!;
  if (!canEditEmployee(user.role)) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  try {
    await initStorage();

    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    const employeeIdRaw = formData.get("employeeId");
    const employeeId = parsePositiveIntFormValue(employeeIdRaw);
    if (employeeId == null) {
      return NextResponse.json(
        {
          error: "Selectați un angajat valid din listă.",
          field: "employeeId",
        },
        { status: 400 },
      );
    }

    const typeRaw = formData.get("type");
    const type =
      typeof typeRaw === "string"
        ? typeRaw.trim()
        : typeRaw != null
          ? String(typeRaw).trim()
          : "";
    const numberRaw = (formData.get("number") as string) ?? "";
    const number = numberRaw.trim() || null;
    const issueDateStr =
      ((formData.get("issueDate") as string) ?? "").trim() || null;
    const expiryDateStr =
      ((formData.get("expiryDate") as string) ?? "").trim() || null;

    // ─── Validare ────────────────────────────────────────────────

    if (!file) {
      return NextResponse.json({ error: "Fișier lipsă" }, { status: 400 });
    }

    if (!isValidDocumentType(type)) {
      return NextResponse.json(
        {
          error: "Tip document invalid",
          validTypes: [...DOCUMENT_TYPES],
        },
        { status: 400 },
      );
    }

    if (!number) {
      return NextResponse.json(
        { error: "Număr document obligatoriu (ex. nr. contract, serie CI)" },
        { status: 400 },
      );
    }
    if (!issueDateStr) {
      return NextResponse.json(
        { error: "Data emiterii este obligatorie" },
        { status: 400 },
      );
    }
    if (!expiryDateStr) {
      return NextResponse.json(
        { error: "Data expirării este obligatorie" },
        { status: 400 },
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        organizationId: true,
      },
    });
    if (!employee) {
      return NextResponse.json(
        { error: "Angajatul nu există", field: "employeeId" },
        { status: 400 },
      );
    }

    // Verifică fișier
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Fișier prea mare. Maxim: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 },
      );
    }

    const mimeType = file.type || getMimeType(file.name);
    if (!isAllowedMimeType(mimeType) || !isAllowedExtension(file.name)) {
      return NextResponse.json(
        { error: "Tip fișier neacceptat. Acceptate: PDF, JPG, PNG" },
        { status: 400 },
      );
    }

    // ─── Parse date ──────────────────────────────────────────────

    const issueDate = new Date(issueDateStr!);
    const expiryDate = new Date(expiryDateStr!);
    if (Number.isNaN(issueDate.getTime())) {
      return NextResponse.json(
        { error: "Data emiterii invalidă" },
        { status: 400 },
      );
    }
    if (Number.isNaN(expiryDate.getTime())) {
      return NextResponse.json(
        { error: "Data expirării invalidă" },
        { status: 400 },
      );
    }

    if (expiryDate < issueDate) {
      return NextResponse.json(
        { error: "Data expirării trebuie să fie după data emiterii" },
        { status: 400 },
      );
    }

    // ─── Salvează fișier pe disk ─────────────────────────────────

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { relativePath } = await saveFile(
      employeeId,
      type,
      file.name,
      buffer,
    );

    // ─── Calculează status automat ───────────────────────────────

    const status = calculateStatus(expiryDate);

    // ─── Creează record DB ───────────────────────────────────────

    const document = await prisma.document.create({
      data: {
        organizationId: employee.organizationId,
        employeeId,
        type,
        number,
        fileName: file.name,
        storagePath: relativePath,
        fileSize: file.size,
        mimeType,
        status,
        issueDate,
        expiryDate,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // ─── Audit log ───────────────────────────────────────────────

    const { createSafeAuditLog } = await import("@/lib/auditInsert");
    void createSafeAuditLog({
      action: "CREATE",
      entity: "Document",
      entityId: employeeId,
      newValues: JSON.stringify({
        documentId: document.id,
        type,
        employeeId,
        fileName: file.name,
        status,
      }),
    });

    return NextResponse.json(
      {
        id: document.id,
        type: document.type,
        number: document.number,
        fileName: document.fileName,
        status: document.status,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        issueDate: document.issueDate ? document.issueDate.toISOString() : null,
        expiryDate: document.expiryDate
          ? document.expiryDate.toISOString()
          : null,
        employee: document.employee,
        downloadUrl: `/api/documents/${document.id}/download`,
        createdAt: document.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[DOCUMENT_UPLOAD]", error);
    return NextResponse.json({ error: "Eroare la upload" }, { status: 500 });
  }
}
