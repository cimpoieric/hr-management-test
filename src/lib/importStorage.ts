import "server-only";

import path from "path";
import {
  isS3ObjectStorageEnabled,
  s3CopyObject,
  s3DeleteObject,
  s3GetObject,
  s3PutObject,
} from "@/lib/s3ObjectStorage";
import fs from "fs/promises";

const S3_IMPORT_PREFIX = "imports";

function shouldUseS3Storage(): boolean {
  return isS3ObjectStorageEnabled();
}

function assertLocalImportAllowed(): void {
  if (process.env.VERCEL === "1" && !shouldUseS3Storage()) {
    throw new Error(
      "Importurile necesita stocare R2/S3 pe Vercel. Configureaza variabilele S3_*.",
    );
  }
}

/** Vercel serverless: /tmp daca S3 lipseste. Local dev: project data/import. */
export function getImportRootDir(): string {
  if (shouldUseS3Storage()) {
    return S3_IMPORT_PREFIX;
  }
  if (process.env.VERCEL === "1") {
    return path.join("/tmp", "hr-import");
  }
  return path.join(process.cwd(), "data", "import");
}

export async function ensureImportDir(subdir: string): Promise<string> {
  if (shouldUseS3Storage()) {
    return `${S3_IMPORT_PREFIX}/${subdir}`.replace(/\\/g, "/");
  }
  const dir = path.join(getImportRootDir(), subdir);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/** Relative path stored in PendingImport.filePath (portable across envs). */
export function toStoredImportRelativePath(
  subdir: "pending" | "rejected" | "email",
  fileName: string,
  emailImportId?: number,
): string {
  if (subdir === "email" && emailImportId != null) {
    return `email/${emailImportId}/${fileName}`.replace(/\\/g, "/");
  }
  return `${subdir}/${fileName}`.replace(/\\/g, "/");
}

function s3KeyForStoredPath(storedPath: string): string {
  const normalized = storedPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.startsWith(`${S3_IMPORT_PREFIX}/`)) {
    return normalized;
  }
  return `${S3_IMPORT_PREFIX}/${normalized}`;
}

/**
 * Resolve DB filePath to absolute path for read/write (local) or S3 key.
 */
export function resolveImportFileAbsolutePath(storedPath: string): string {
  if (shouldUseS3Storage()) {
    return s3KeyForStoredPath(storedPath);
  }

  const normalized = storedPath.replace(/\\/g, "/").trim();
  if (path.isAbsolute(normalized)) {
    return normalized;
  }

  const withoutDot = normalized.replace(/^\.\//, "");

  if (withoutDot.startsWith("data/import/")) {
    return path.join(process.cwd(), withoutDot);
  }

  if (
    withoutDot.startsWith("pending/") ||
    withoutDot.startsWith("rejected/") ||
    withoutDot.startsWith("email/")
  ) {
    return path.join(getImportRootDir(), withoutDot);
  }

  return path.join(process.cwd(), withoutDot);
}

export async function readImportFile(storedPath: string): Promise<Buffer> {
  if (shouldUseS3Storage()) {
    return s3GetObject(s3KeyForStoredPath(storedPath));
  }
  return fs.readFile(resolveImportFileAbsolutePath(storedPath));
}

export async function writePendingImportFile(
  buffer: Buffer,
  originalFileName: string,
): Promise<{ absolutePath: string; storedPath: string }> {
  const timestamp = Date.now();
  const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${timestamp}_${safeName}`;
  const storedPath = toStoredImportRelativePath("pending", fileName);

  if (shouldUseS3Storage()) {
    const key = s3KeyForStoredPath(storedPath);
    await s3PutObject(key, buffer);
    return { absolutePath: key, storedPath };
  }

  assertLocalImportAllowed();
  const pendingDir = await ensureImportDir("pending");
  const absolutePath = path.join(pendingDir, fileName);
  await fs.writeFile(absolutePath, buffer);
  return { absolutePath, storedPath };
}

export async function writeEmailImportAttachment(
  emailImportId: number,
  buffer: Buffer,
  originalFileName: string,
  index: number,
): Promise<{ absolutePath: string; storedPath: string }> {
  const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${Date.now()}_${index}_${safeName}`;
  const storedPath = toStoredImportRelativePath(
    "email",
    fileName,
    emailImportId,
  );

  if (shouldUseS3Storage()) {
    const key = s3KeyForStoredPath(storedPath);
    await s3PutObject(key, buffer);
    return { absolutePath: key, storedPath };
  }

  assertLocalImportAllowed();
  const emailDir = await ensureImportDir(`email/${emailImportId}`);
  const absolutePath = path.join(emailDir, fileName);
  await fs.writeFile(absolutePath, buffer);
  return { absolutePath, storedPath };
}

export async function moveImportFileToRejected(
  storedPath: string,
  displayFileName: string,
): Promise<void> {
  const destName = `${Date.now()}_${displayFileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const destStored = toStoredImportRelativePath("rejected", destName);

  if (shouldUseS3Storage()) {
    const sourceKey = s3KeyForStoredPath(storedPath);
    const destKey = s3KeyForStoredPath(destStored);
    await s3CopyObject(sourceKey, destKey);
    await s3DeleteObject(sourceKey);
    return;
  }

  const source = resolveImportFileAbsolutePath(storedPath);
  const rejectedDir = await ensureImportDir("rejected");
  const dest = path.join(rejectedDir, destName);
  try {
    await fs.rename(source, dest);
  } catch {
    try {
      const buf = await fs.readFile(source);
      await fs.writeFile(dest, buf);
      await fs.unlink(source).catch(() => undefined);
    } catch {
      // source missing
    }
  }
}
