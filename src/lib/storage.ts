/**
 * Stocare documente HR (server only).
 * Productie: Cloudflare R2 / S3 (S3_* env). Dev: disc local daca S3 lipseste.
 */

import "server-only";

import path from "path";
import {
  type DocumentType,
  sanitizeFilename,
  getMimeType,
} from "@/lib/documentConstants";
import {
  isS3ObjectStorageEnabled,
  s3CopyObject,
  s3DeleteObject,
  s3GetObject,
  s3HeadObject,
  s3PutObject,
} from "@/lib/s3ObjectStorage";
import fs from "fs/promises";

export {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  DOCUMENT_TYPES,
  type DocumentType,
  isValidDocumentType,
  isAllowedMimeType,
  isAllowedExtension,
  sanitizeFilename,
  getMimeType,
} from "@/lib/documentConstants";

const BASE_DIR = process.env.DOCUMENTS_PATH ?? "./data/documents";
const DELETED_DIR = path.join(BASE_DIR, "_deleted");
const S3_PREFIX = "documents";

function shouldUseS3Storage(): boolean {
  return isS3ObjectStorageEnabled();
}

function assertLocalAllowed(): void {
  if (process.env.VERCEL === "1" && !shouldUseS3Storage()) {
    throw new Error(
      "Documentele necesita stocare R2/S3 pe Vercel. Configureaza S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY si S3_ENDPOINT.",
    );
  }
}

function s3KeyForRelative(relativePath: string): string {
  return `${S3_PREFIX}/${relativePath.replace(/\\/g, "/")}`;
}

/** Generează calea de stocare relativă. */
export function buildStoragePath(
  employeeId: number,
  docType: DocumentType,
  originalName: string,
): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now();
  const safeName = sanitizeFilename(originalName);
  return path.join(
    String(employeeId),
    docType,
    String(year),
    `${timestamp}_${safeName}`,
  );
}

/** Calea absolută pe disk dintr-o cale relativă (doar mod local). */
export function resolveAbsolutePath(relativePath: string): string {
  return path.join(BASE_DIR, relativePath);
}

/** Asigură existența directoarelor (mod local). */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/** Salvează fișierul. Returnează calea relativă. */
export async function saveFile(
  employeeId: number,
  docType: DocumentType,
  originalName: string,
  buffer: Buffer,
): Promise<{ relativePath: string; absolutePath: string }> {
  const relativePath = buildStoragePath(employeeId, docType, originalName);

  if (shouldUseS3Storage()) {
    const key = s3KeyForRelative(relativePath);
    await s3PutObject(key, buffer, getMimeType(originalName));
    return { relativePath, absolutePath: `s3://${key}` };
  }

  assertLocalAllowed();
  const absolutePath = resolveAbsolutePath(relativePath);
  await ensureDir(path.dirname(absolutePath));
  await fs.writeFile(absolutePath, buffer);
  return { relativePath, absolutePath };
}

/** Citește fișierul. */
export async function readFile(relativePath: string): Promise<Buffer> {
  if (shouldUseS3Storage()) {
    return s3GetObject(s3KeyForRelative(relativePath));
  }
  const absolutePath = resolveAbsolutePath(relativePath);
  return fs.readFile(absolutePath);
}

/** Returnează un readable stream pentru fișier. */
export async function createReadStream(
  relativePath: string,
): Promise<NodeJS.ReadableStream> {
  const buffer = await readFile(relativePath);
  const { Readable } = await import("stream");
  return Readable.from(buffer);
}

/** Verifică existența fișierului. */
export async function fileExists(relativePath: string): Promise<boolean> {
  if (shouldUseS3Storage()) {
    return s3HeadObject(s3KeyForRelative(relativePath));
  }
  try {
    const absolutePath = resolveAbsolutePath(relativePath);
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/** Soft delete: mută fișierul în _deleted/ (local) sau prefix deleted/ (S3). */
export async function softDeleteFile(relativePath: string): Promise<void> {
  const filename = path.basename(relativePath);
  const deletedName = `${Date.now()}_${filename}`;

  if (shouldUseS3Storage()) {
    const sourceKey = s3KeyForRelative(relativePath);
    const destKey = s3KeyForRelative(path.join("_deleted", deletedName));
    await s3CopyObject(sourceKey, destKey);
    await s3DeleteObject(sourceKey);
    return;
  }

  const absolutePath = resolveAbsolutePath(relativePath);
  const deletedPath = path.join(DELETED_DIR, deletedName);
  await ensureDir(DELETED_DIR);
  await fs.rename(absolutePath, deletedPath);
}

/** Returnează dimensiunea fișierului în bytes. */
export async function getFileSize(relativePath: string): Promise<number> {
  const buf = await readFile(relativePath);
  return buf.length;
}

/** Inițializare: creează directoarele necesare (mod local). */
export async function initStorage(): Promise<void> {
  if (shouldUseS3Storage()) return;
  assertLocalAllowed();
  await ensureDir(BASE_DIR);
  await ensureDir(DELETED_DIR);
}
