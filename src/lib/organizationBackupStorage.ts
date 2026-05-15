import "server-only";

import { existsSync } from "fs";
import { join } from "path";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "fs/promises";
import {
  isS3ObjectStorageEnabled,
  s3DeleteObject,
  s3GetObject,
  s3ListObjects,
  s3PublicUrlForKey,
  s3PutObject,
} from "@/lib/s3ObjectStorage";

const FIRM_PREFIX = "firm";
const LOCAL_BACKUPS_ROOT = join(process.cwd(), "data", "backups");

function shouldUseS3Storage(): boolean {
  return isS3ObjectStorageEnabled();
}

function assertLocalAllowed(): void {
  if (process.env.VERCEL === "1" && !shouldUseS3Storage()) {
    throw new Error(
      "Backup-urile necesita stocare R2/S3 pe Vercel. Configureaza variabilele S3_*.",
    );
  }
}

export function sanitizeBackupFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function buildBackupFilename(prefix = ""): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${prefix}${timestamp}.zip`;
}

export function buildBackupS3Key(
  organizationId: string,
  filename: string,
): string {
  return `${FIRM_PREFIX}/${organizationId}/backup/${sanitizeBackupFilename(filename)}`;
}

function backupPrefixForOrganization(organizationId: string): string {
  return `${FIRM_PREFIX}/${organizationId}/backup/`;
}

function localDirForOrganization(organizationId: string): string {
  return join(LOCAL_BACKUPS_ROOT, organizationId);
}

function filenameFromS3Key(key: string, organizationId: string): string {
  const prefix = backupPrefixForOrganization(organizationId);
  return key.startsWith(prefix) ? key.slice(prefix.length) : key.split("/").pop() ?? key;
}

export async function putOrganizationBackup(
  organizationId: string,
  filename: string,
  buffer: Buffer,
): Promise<{ key: string; downloadUrl: string | null }> {
  const safeName = sanitizeBackupFilename(filename);

  if (shouldUseS3Storage()) {
    const key = buildBackupS3Key(organizationId, safeName);
    await s3PutObject(key, buffer, "application/zip");
    return { key, downloadUrl: s3PublicUrlForKey(key) };
  }

  assertLocalAllowed();
  const dir = localDirForOrganization(organizationId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const filePath = join(dir, safeName);
  await writeFile(filePath, buffer);
  return { key: filePath, downloadUrl: null };
}

export async function getOrganizationBackupBuffer(
  organizationId: string,
  filename: string,
): Promise<Buffer> {
  const safeName = sanitizeBackupFilename(filename);

  if (shouldUseS3Storage()) {
    const key = buildBackupS3Key(organizationId, safeName);
    return s3GetObject(key);
  }

  const filePath = join(localDirForOrganization(organizationId), safeName);
  if (!existsSync(filePath)) {
    throw new Error("Backup negasit");
  }
  return readFile(filePath);
}

export async function deleteOrganizationBackup(
  organizationId: string,
  filename: string,
): Promise<void> {
  const safeName = sanitizeBackupFilename(filename);

  if (shouldUseS3Storage()) {
    await s3DeleteObject(buildBackupS3Key(organizationId, safeName));
    return;
  }

  const filePath = join(localDirForOrganization(organizationId), safeName);
  if (existsSync(filePath)) {
    await rm(filePath);
  }
}

export type StoredBackupObject = {
  filename: string;
  size: number;
  createdAt: Date;
  key: string;
};

export async function listOrganizationBackups(
  organizationId: string,
): Promise<StoredBackupObject[]> {
  if (shouldUseS3Storage()) {
    const prefix = backupPrefixForOrganization(organizationId);
    const objects = await s3ListObjects(prefix);
    return objects
      .filter((obj) => obj.key.endsWith(".zip"))
      .map((obj) => ({
        filename: filenameFromS3Key(obj.key, organizationId),
        size: obj.size,
        createdAt: obj.lastModified,
        key: obj.key,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  const dir = localDirForOrganization(organizationId);
  if (!existsSync(dir)) return [];

  const files = await readdir(dir);
  const backups: StoredBackupObject[] = [];

  for (const filename of files) {
    if (!filename.endsWith(".zip")) continue;
    const filePath = join(dir, filename);
    try {
      const fileStat = await stat(filePath);
      backups.push({
        filename,
        size: fileStat.size,
        createdAt: fileStat.mtime,
        key: filePath,
      });
    } catch {
      // skip
    }
  }

  return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Agregat pentru panoul super-admin (toate firmele din R2 / disc local). */
export async function listAllStoredBackups(): Promise<StoredBackupObject[]> {
  if (shouldUseS3Storage()) {
    const objects = await s3ListObjects(`${FIRM_PREFIX}/`);
    return objects
      .filter((obj) => obj.key.includes("/backup/") && obj.key.endsWith(".zip"))
      .map((obj) => {
        const parts = obj.key.split("/");
        const filename = parts[parts.length - 1] ?? obj.key;
        return {
          filename,
          size: obj.size,
          createdAt: obj.lastModified,
          key: obj.key,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  if (!existsSync(LOCAL_BACKUPS_ROOT)) return [];

  const orgDirs = await readdir(LOCAL_BACKUPS_ROOT);
  const all: StoredBackupObject[] = [];
  for (const orgId of orgDirs) {
    const orgBackups = await listOrganizationBackups(orgId);
    all.push(...orgBackups);
  }
  return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
