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

import {
  ensureImportDir,
  writeEmailImportAttachment,
} from "@/lib/importStorage";
import { extractFields } from "@/lib/parsers/fieldExtractor";
import { extractTextFromImage } from "@/lib/parsers/ocrParser";
import { extractTextFromPDF } from "@/lib/parsers/pdfParser";
import { prisma, prismaBase } from "@/lib/prisma";
import { UserRole } from "@/lib/roles";
import { runWithTenantContext } from "@/lib/tenantRequestStorage";
import { markAsSeen } from "./imapClient";
import type { EmailAttachment, EmailMessage } from "./imapClient";
import { ALLOWED_EXTENSIONS, getMimeType } from "./storage";
import path from "path";

async function resolveDefaultOrganizationIdForEmailCron(): Promise<string> {
  const o = await prismaBase.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!o?.id) {
    throw new Error("Lipseste Organization pentru import email.");
  }
  return o.id;
}

/**
 * Procesează un email: verifică deduplicare, salvează atașamente,
 * creează PendingImport-uri (tenant = prima organizație din DB — IMAP global).
 */
export async function processEmail(message: EmailMessage): Promise<{
  emailImportId: number;
  pendingImports: number;
  errors: string[];
}> {
  const organizationId = await resolveDefaultOrganizationIdForEmailCron();
  return runWithTenantContext(
    {
      organizationId,
      userId: "email-cron",
      email: "cron@local",
      role: UserRole.OPERATOR,
    },
    () => processEmailCore(message, organizationId),
  );
}

async function processEmailCore(
  message: EmailMessage,
  organizationId: string,
): Promise<{
  emailImportId: number;
  pendingImports: number;
  errors: string[];
}> {
  const errors: string[] = [];

  // 1. Deduplicare — verifică dacă acest UID a mai fost procesat
  const existing = await prisma.emailImport.findUnique({
    where: { imapUid: message.uid.toString() },
  });

  if (existing) {
    return {
      emailImportId: existing.id,
      pendingImports: 0,
      errors: ["Email deja procesat"],
    };
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

  await ensureImportDir(`email/${emailImport.id}`);

  let pendingCount = 0;

  // 3. Procesează fiecare atașament (max 10 deja limitat în imapClient)
  for (let i = 0; i < message.attachments.length; i++) {
    const attachment = message.attachments[i];
    if (!attachment) continue;

    try {
      const result = await processAttachment(
        emailImport.id,
        attachment,
        i,
        message,
        organizationId,
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

  return {
    emailImportId: emailImport.id,
    pendingImports: pendingCount,
    errors,
  };
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
  attachment: EmailAttachment,
  index: number,
  message: EmailMessage,
  organizationId: string,
): Promise<boolean> {
  const ext = path.extname(attachment.filename).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return false;
  }

  const { storedPath } = await writeEmailImportAttachment(
    emailImportId,
    attachment.content,
    attachment.filename,
    index,
  );

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
      organizationId,
      sourceType: "EMAIL",
      fileName: attachment.filename,
      filePath: storedPath,
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
