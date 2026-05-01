/**
 * POST /api/import/manual
 *
 * Primește un fișier (PDF sau imagine), extrage text, parsează câmpuri,
 * creează un PendingImport în DB pentru review uman.
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canEditEmployee } from "@/lib/permissions";
import { extractTextFromPDF } from "@/lib/parsers/pdfParser";
import { extractTextFromImage } from "@/lib/parsers/ocrParser";
import { extractFields } from "@/lib/parsers/fieldExtractor";
import {
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS,
  getMimeType,
} from "@/lib/documentConstants";

const IMPORT_DIR = "./data/import/pending";
const REJECTED_DIR = "./data/import/rejected";

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Detectează dacă fișierul e PDF sau imagine și extrage text.
 */
async function extractText(
  file: File,
  buffer: Buffer
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

// ─── POST ────────────────────────────────────────────────────────────────────

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
    await ensureDir(IMPORT_DIR);
    await ensureDir(REJECTED_DIR);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Fișier lipsă" }, { status: 400 });
    }

    // ─── Validare fișier ─────────────────────────────────────────
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Fișier prea mare. Max: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "Extensie neacceptată. Folosește PDF, JPG sau PNG." },
        { status: 400 }
      );
    }

    // ─── Salvare fișier temporar ─────────────────────────────────
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${timestamp}_${safeName}`;
    const filePath = path.join(IMPORT_DIR, fileName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.writeFile(filePath, buffer);

    // ─── Extrage text ────────────────────────────────────────────
    let rawText: string;
    let ocrConfidence: number | undefined;

    try {
      const result = await extractText(file, buffer);
      rawText = result.text;
      ocrConfidence = result.ocrConfidence;
    } catch (extractError) {
      // Dacă extragerea eșuează, salvăm eroarea dar continuăm
      rawText = extractError instanceof Error ? extractError.message : "Eroare extragere";
    }

    // ─── Extrage câmpuri ─────────────────────────────────────────
    const { fields, confidenceScore, uncertainFields } = extractFields(rawText);

    // Ajustează scorul cu OCR confidence dacă există
    const finalConfidence = ocrConfidence
      ? (confidenceScore + ocrConfidence / 100) / 2
      : confidenceScore;

    // ─── Creează PendingImport ───────────────────────────────────
    const pending = await prisma.pendingImport.create({
      data: {
        sourceType: "MANUAL_UPLOAD",
        fileName: file.name,
        filePath: filePath, // cale absolută pentru acces intern
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
      { status: 201 }
    );
  } catch (error) {
    console.error("[IMPORT_MANUAL]", error);
    return NextResponse.json(
      { error: "Eroare la procesare" },
      { status: 500 }
    );
  }
}
