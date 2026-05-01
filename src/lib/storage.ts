/**
 * Gestionare fișiere pe disk pentru documente HR (doar server).
 */

import "server-only";

import fs from "fs/promises";
import path from "path";
import {
  type DocumentType,
  sanitizeFilename,
} from "@/lib/documentConstants";

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

/** Generează calea de stocare relativă. */
export function buildStoragePath(
  employeeId: number,
  docType: DocumentType,
  originalName: string
): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now();
  const safeName = sanitizeFilename(originalName);
  return path.join(
    String(employeeId),
    docType,
    String(year),
    `${timestamp}_${safeName}`
  );
}

/** Calea absolută pe disk dintr-o cale relativă. */
export function resolveAbsolutePath(relativePath: string): string {
  return path.join(BASE_DIR, relativePath);
}

/** Asigură existența directoarelor. */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/** Salvează fișierul pe disk. Returnează calea relativă. */
export async function saveFile(
  employeeId: number,
  docType: DocumentType,
  originalName: string,
  buffer: Buffer
): Promise<{ relativePath: string; absolutePath: string }> {
  const relativePath = buildStoragePath(employeeId, docType, originalName);
  const absolutePath = resolveAbsolutePath(relativePath);

  await ensureDir(path.dirname(absolutePath));
  await fs.writeFile(absolutePath, buffer);

  return { relativePath, absolutePath };
}

/** Citește fișierul de pe disk. */
export async function readFile(relativePath: string): Promise<Buffer> {
  const absolutePath = resolveAbsolutePath(relativePath);
  return fs.readFile(absolutePath);
}

/** Returnează un readable stream pentru fișier. */
export async function createReadStream(
  relativePath: string
): Promise<NodeJS.ReadableStream> {
  const absolutePath = resolveAbsolutePath(relativePath);
  const { createReadStream: crs } = await import("fs");
  return crs(absolutePath);
}

/** Verifică existența fișierului. */
export async function fileExists(relativePath: string): Promise<boolean> {
  try {
    const absolutePath = resolveAbsolutePath(relativePath);
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/** Soft delete: mută fișierul în _deleted/. */
export async function softDeleteFile(relativePath: string): Promise<void> {
  const absolutePath = resolveAbsolutePath(relativePath);
  const filename = path.basename(relativePath);
  const deletedPath = path.join(DELETED_DIR, `${Date.now()}_${filename}`);

  await ensureDir(DELETED_DIR);
  await fs.rename(absolutePath, deletedPath);
}

/** Returnează dimensiunea fișierului în bytes. */
export async function getFileSize(relativePath: string): Promise<number> {
  const absolutePath = resolveAbsolutePath(relativePath);
  const stat = await fs.stat(absolutePath);
  return stat.size;
}

/** Inițializare: creează directoarele necesare. */
export async function initStorage(): Promise<void> {
  await ensureDir(BASE_DIR);
  await ensureDir(DELETED_DIR);
}
