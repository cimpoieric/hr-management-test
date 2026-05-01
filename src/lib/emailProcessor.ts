/**
 * Procesor email — convertește emailuri IMAP în PendingImport-uri.
 *
 * Flow:
 *   1. Verifică deduplicare (imapUid există deja în EmailImport?)
 *   2. Creează EmailImport record
 *   3. Pentru fiecare atașament valid:
 *      - Salvează pe disk
 *      - Extrage text (PDF → pdfParser, imagine → OCR)
 *      - Extrage câmpuri (fieldExtractor)
 *      - Creează PendingImport
 *   4. Marchează emailul ca SEEN pe server
 *   5. Actualizează EmailImport status
 */

import path from "path";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import { extractTextFromPDF } from "@/lib/parsers/pdfParser";
import { extractTextFromImage } from "@/lib/parsers/ocrParser";
import { extractFields } from "@/lib/parsers/fieldExtractor";
import { markAsSeen } from "./imapClient";
import type { EmailMessage, EmailAttachment } from "./imapClient";
import { ALLOWED_EXTENSIONS, getMimeType } from "./storage";

const IMPORT_BASE_DIR = "./data/import";

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Procesează un email: verifică deduplicare, salvează atașamente,
 * creează PendingImport-uri.
 */
export async function processEmail(
  message: EmailMessage
): Promise<{ emailImportId: number; pendingImports: number; errors: string[] }> {
  const errors: string[] = [];

  // 1. Deduplicare — verifică dacă acest UID a mai fost procesat
  const existing = await prisma.emailImport.findUnique({
    where: { imapUid: message.uid.toString() },
  });

  if (existing) {
    return { emailImportId: existing.id, pendingImports: 0, errors: ["Email deja procesat"] };
  }

  // 2. Creează EmailImport
  const emailImport = await prisma.emailImport.create({
    data: {
      imapUid: message.uid.toString(),
      subject: message.subject,
      fromAddress: message.from.address,
      receivedAt: message.date,
      attachments: message.attachments.length,
      status: "PENDING",
    },
  });

  const emailDir = path.join(IMPORT_BASE_DIR, "email", String(emailImport.id));
  await ensureDir(emailDir);

  let pendingCount = 0;

  // 3. Procesează fiecare atașament (max 10 deja limitat în imapClient)
  for (let i = 0; i < message.attachments.length; i++) {
    const attachment = message.attachments[i];
    if (!attachment) continue;

    try {
      const result = await processAttachment(
        emailImport.id,
        emailDir,
        attachment,
        i,
        message
      );
      if (result) pendingCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Eroare necunoscută";
      errors.push(`Atașament ${attachment.filename}: ${msg}`);
    }
  }

  // 4. Actualizează EmailImport
  await prisma.emailImport.update({
    where: { id: emailImport.id },
    data: {
      status: errors.length > 0 && pendingCount === 0 ? "ERROR" : "PROCESSED",
      processed: pendingCount,
      errorMessage: errors.length > 0 ? errors.join("; ") : null,
    },
  });

  // 5. Marchează emailul ca SEEN pe server (nu șterge)
  try {
    await markAsSeen(message.uid);
  } catch {
    errors.push("Nu s-a putut marca emailul ca citit pe server");
  }

  return { emailImportId: emailImport.id, pendingImports: pendingCount, errors };
}

/**
 * Procesează un singur atașament:
 *   - Salvează pe disk
 *   - Extrage text
 *   - Parsează câmpuri
 *   - Creează PendingImport
 */
async function processAttachment(
  emailImportId: number,
  emailDir: string,
  attachment: EmailAttachment,
  index: number,
  message: EmailMessage
): Promise<boolean> {
  const ext = path.extname(attachment.filename).toLowerCase();

  // Verifică extensie
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return false;
  }

  // Salvează pe disk
  const safeName = attachment.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${Date.now()}_${index}_${safeName}`;
  const filePath = path.join(emailDir, fileName);
  await fs.writeFile(filePath, attachment.content);

  // Extrage text
  let rawText = "";
  let ocrConfidence: number | undefined;

  try {
    if (attachment.contentType === "application/pdf") {
      rawText = await extractTextFromPDF(attachment.content);
    } else if (attachment.contentType.startsWith("image/")) {
      const result = await extractTextFromImage(attachment.content);
      rawText = result.text;
      ocrConfidence = result.confidence;
    } else {
      return false;
    }
  } catch {
    rawText = message.bodyText || "";
  }

  // Extrage câmpuri
  const { fields, confidenceScore, uncertainFields } = extractFields(rawText);

  const finalConfidence = ocrConfidence
    ? (confidenceScore + ocrConfidence / 100) / 2
    : confidenceScore;

  // Creează PendingImport
  await prisma.pendingImport.create({
    data: {
      sourceType: "EMAIL",
      fileName: attachment.filename,
      filePath: filePath,
      mimeType: attachment.contentType || getMimeType(attachment.filename),
      fileSize: attachment.size,
      rawText,
      extractedFields: JSON.stringify(fields),
      confidenceScore: Math.round(finalConfidence * 100) / 100,
      uncertainFields: JSON.stringify(uncertainFields),
      status: "PENDING",
      notes: `Email: "${message.subject}" de la ${message.from.address}`,
    },
  });

  return true;
}
