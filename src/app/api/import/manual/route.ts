/**
 * POST /api/import/manual
 *
 * Primește un fișier (PDF sau imagine), extrage text, parsează câmpuri,
 * creează un PendingImport în DB pentru review uman.
 */

import { requireRole } from "@/lib/auth";
import { ROLES_EMPLOYEES_RW } from "@/lib/roles";
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  getMimeType,
} from "@/lib/documentConstants";
import { writePendingImportFile } from "@/lib/importStorage";
import { extractFields } from "@/lib/parsers/fieldExtractor";
import { extractTextFromImage } from "@/lib/parsers/ocrParser";
import { extractTextFromPDF } from "@/lib/parsers/pdfParser";
import { canEditEmployee } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import path from "path";
import { type NextRequest, NextResponse } from "next/server";

async function extractText(
  file: File,
  buffer: Buffer,
): Promise<{ text: string; ocrConfidence?: number }> {
  const mimeType = file.type || getMimeType(file.name);

  if (mimeType === "application/pdf") {
    const text = await extractTextFromPDF(buffer);
    return { text };
  }

  if (mimeType.startsWith("image/")) {
    const { text, confidence } = await extractTextFromImage(buffer);
    return { text, ocrConfidence: confidence };
  }

  throw new Error("Tip fișier nesupportat pentru extragere text.");
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
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Fișier lipsă" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Fișier prea mare. Max: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 },
      );
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "Extensie neacceptată. Folosește PDF, JPG sau PNG." },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const { storedPath } = await writePendingImportFile(buffer, file.name);

    let rawText: string;
    let ocrConfidence: number | undefined;

    try {
      const result = await extractText(file, buffer);
      rawText = result.text;
      ocrConfidence = result.ocrConfidence;
    } catch (extractError) {
      rawText =
        extractError instanceof Error
          ? extractError.message
          : "Eroare extragere";
    }

    const { fields, confidenceScore, uncertainFields } = extractFields(rawText);

    const finalConfidence = ocrConfidence
      ? (confidenceScore + ocrConfidence / 100) / 2
      : confidenceScore;

    const pending = await prisma.pendingImport.create({
      data: {
        organizationId: String(user.organizationId),
        sourceType: "MANUAL_UPLOAD",
        fileName: file.name,
        filePath: storedPath,
        mimeType: file.type || getMimeType(file.name),
        fileSize: file.size,
        rawText,
        extractedFields: JSON.stringify(fields),
        confidenceScore: Math.round(finalConfidence * 100) / 100,
        uncertainFields: JSON.stringify(uncertainFields),
        status: "PENDING",
      },
    });

    return NextResponse.json(
      {
        id: pending.id,
        fileName: pending.fileName,
        mimeType: pending.mimeType,
        confidenceScore: pending.confidenceScore,
        uncertainFields,
        fields,
        rawTextLength: rawText.length,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[IMPORT_MANUAL]", error);
    const msg = error instanceof Error ? error.message : "Eroare la procesare";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
