/**
 * POST /api/documents/upload
 *
 * Upload document: primește FormData cu fișier + metadate.
 * Validează: employee există, tip valid, fișier valid (max 50MB, pdf/jpg/png).
 * Salvează pe disk, creează record DB cu status automat.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canEditEmployee } from "@/lib/permissions";
import {
  saveFile,
  isValidDocumentType,
  isAllowedMimeType,
  isAllowedExtension,
  MAX_FILE_SIZE,
  getMimeType,
  getFileSize,
  initStorage,
} from "@/lib/storage";
import { calculateStatus } from "@/lib/documentStatus";

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
    await initStorage();

    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    const employeeIdRaw = formData.get("employeeId");
    const employeeIdStr =
      typeof employeeIdRaw === "string"
        ? employeeIdRaw.trim()
        : employeeIdRaw != null
          ? String(employeeIdRaw).trim()
          : "";

    const employeeIdParsed = z
      .string()
      .min(1, { message: "Angajatul este obligatoriu" })
      .regex(/^\d+$/, {
        message: "Selectați un angajat valid din listă.",
      })
      .transform((s) => parseInt(s, 10))
      .pipe(z.number().int().positive({ message: "ID angajat invalid." }))
      .safeParse(employeeIdStr);

    if (!employeeIdParsed.success) {
      const msg =
        employeeIdParsed.error.issues[0]?.message ?? "Angajatul este obligatoriu";
      return NextResponse.json(
        { error: msg, field: "employeeId" },
        { status: 400 }
      );
    }

    const employeeId = employeeIdParsed.data;
    const type = formData.get("type") as string;
    const numberRaw = (formData.get("number") as string) ?? "";
    const number = numberRaw.trim() || null;
    const issueDateStr = ((formData.get("issueDate") as string) ?? "").trim() || null;
    const expiryDateStr = ((formData.get("expiryDate") as string) ?? "").trim() || null;

    // ─── Validare ────────────────────────────────────────────────

    if (!file) {
      return NextResponse.json(
        { error: "Fișier lipsă" },
        { status: 400 }
      );
    }

    if (!isValidDocumentType(type)) {
      return NextResponse.json(
        { error: "Tip document invalid", validTypes: ["CONTRACT", "ID", "MEDICAL", "A1", "AUTHORIZATION", "VISA", "OTHER"] },
        { status: 400 }
      );
    }

    if (!number) {
      return NextResponse.json(
        { error: "Număr document obligatoriu (ex. nr. contract, serie CI)" },
        { status: 400 }
      );
    }
    if (!issueDateStr) {
      return NextResponse.json({ error: "Data emiterii este obligatorie" }, { status: 400 });
    }
    if (!expiryDateStr) {
      return NextResponse.json({ error: "Data expirării este obligatorie" }, { status: 400 });
    }

    // Verifică employee există
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!employee) {
      return NextResponse.json(
        { error: "Angajat negăsit" },
        { status: 404 }
      );
    }

    // Verifică fișier
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Fișier prea mare. Maxim: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    const mimeType = file.type || getMimeType(file.name);
    if (!isAllowedMimeType(mimeType) || !isAllowedExtension(file.name)) {
      return NextResponse.json(
        { error: "Tip fișier neacceptat. Acceptate: PDF, JPG, PNG" },
        { status: 400 }
      );
    }

    // ─── Parse date ──────────────────────────────────────────────

    const issueDate = new Date(issueDateStr!);
    const expiryDate = new Date(expiryDateStr!);
    if (Number.isNaN(issueDate.getTime())) {
      return NextResponse.json({ error: "Data emiterii invalidă" }, { status: 400 });
    }
    if (Number.isNaN(expiryDate.getTime())) {
      return NextResponse.json({ error: "Data expirării invalidă" }, { status: 400 });
    }

    if (expiryDate < issueDate) {
      return NextResponse.json(
        { error: "Data expirării trebuie să fie după data emiterii" },
        { status: 400 }
      );
    }

    // ─── Salvează fișier pe disk ─────────────────────────────────

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { relativePath } = await saveFile(
      employeeId,
      type,
      file.name,
      buffer
    );

    // ─── Calculează status automat ───────────────────────────────

    const status = calculateStatus(expiryDate);

    // ─── Creează record DB ───────────────────────────────────────

    const document = await prisma.document.create({
      data: {
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

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "Document",
        entityId: document.id,
        newValues: JSON.stringify({ type, employeeId, fileName: file.name, status }),
      },
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
        expiryDate: document.expiryDate ? document.expiryDate.toISOString() : null,
        employee: document.employee,
        downloadUrl: `/api/documents/${document.id}/download`,
        createdAt: document.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[DOCUMENT_UPLOAD]", error);
    return NextResponse.json(
      { error: "Eroare la upload" },
      { status: 500 }
    );
  }
}
