import "server-only";

import { existsSync } from "fs";
import { join } from "path";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "fs/promises";
import {
  isS3ObjectStorageEnabled,
  s3DeleteObject,
  s3GetObject,
  s3ListObjects,
  s3PublicUrlForKey,
  s3PutObject,
} from "@/lib/s3ObjectStorage";

const FIRM_PREFIX = "firm";
const REPORT_TTL_MS = 24 * 60 * 60 * 1000;
const LOCAL_REPORTS_ROOT = join(process.cwd(), "data", "reports");

function shouldUseS3Storage(): boolean {
  return isS3ObjectStorageEnabled();
}

function assertLocalAllowed(): void {
  if (process.env.VERCEL === "1" && !shouldUseS3Storage()) {
    throw new Error(
      "Rapoartele PDF necesita stocare R2/S3 pe Vercel. Configureaza variabilele S3_*.",
    );
  }
}

export function buildReportS3Key(
  organizationId: string,
  reportType: string,
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const safeType = reportType.replace(/[^a-z0-9_-]/gi, "_").slice(0, 32);
  return `${FIRM_PREFIX}/${organizationId}/reports/${safeType}-${timestamp}.pdf`;
}

export function reportIdFromStorageKey(key: string): string {
  const base = key.split("/").pop() ?? key;
  return base.replace(/\.pdf$/i, "");
}

export function isReportKeyForOrganization(
  key: string,
  organizationId: string,
): boolean {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  const prefix = `${FIRM_PREFIX}/${organizationId}/reports/`;
  if (!normalized.startsWith(prefix)) return false;
  if (normalized.includes("..")) return false;
  return normalized.endsWith(".pdf");
}

/** Extrage timestamp din cheie `.../lista-2026-05-15T14-30-22.pdf`. */
export function getReportCreatedAtFromKey(key: string): Date | null {
  const base = key.split("/").pop() ?? "";
  const match = base.match(/-(\d{4}-\d{2}-\d{2}T[\d-]+)\.pdf$/i);
  if (!match?.[1]) return null;
  const iso = match[1].replace(
    /T(\d{2})-(\d{2})-(\d{2})$/,
    "T$1:$2:$3",
  );
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

export function isReportKeyExpired(key: string): boolean {
  const createdAt = getReportCreatedAtFromKey(key);
  if (!createdAt) return false;
  return Date.now() - createdAt.getTime() > REPORT_TTL_MS;
}

export async function putOrganizationReport(
  organizationId: string,
  storageKey: string,
  buffer: Buffer,
): Promise<{ key: string; publicUrl: string | null }> {
  if (!isReportKeyForOrganization(storageKey, organizationId)) {
    throw new Error("Cheie raport invalida pentru organizatie");
  }

  if (shouldUseS3Storage()) {
    await s3PutObject(storageKey, buffer, "application/pdf");
    return { key: storageKey, publicUrl: s3PublicUrlForKey(storageKey) };
  }

  assertLocalAllowed();
  const dir = join(LOCAL_REPORTS_ROOT, organizationId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const filename = storageKey.split("/").pop() ?? "report.pdf";
  await writeFile(join(dir, filename), buffer);
  return { key: storageKey, publicUrl: null };
}

export async function getOrganizationReportBuffer(
  organizationId: string,
  storageKey: string,
): Promise<Buffer> {
  if (!isReportKeyForOrganization(storageKey, organizationId)) {
    throw new Error("Acces interzis la raport");
  }

  if (isReportKeyExpired(storageKey)) {
    throw new Error("Raport expirat. Genereaza din nou.");
  }

  if (shouldUseS3Storage()) {
    return s3GetObject(storageKey);
  }

  const filename = storageKey.split("/").pop() ?? "report.pdf";
  const filePath = join(LOCAL_REPORTS_ROOT, organizationId, filename);
  if (!existsSync(filePath)) {
    throw new Error("Raport negasit");
  }
  return readFile(filePath);
}

export async function cleanupOldOrganizationReports(
  organizationId: string,
): Promise<void> {
  const prefix = `${FIRM_PREFIX}/${organizationId}/reports/`;

  if (shouldUseS3Storage()) {
    const objects = await s3ListObjects(prefix);
    for (const obj of objects) {
      if (isReportKeyExpired(obj.key)) {
        await s3DeleteObject(obj.key);
      }
    }
    return;
  }

  const dir = join(LOCAL_REPORTS_ROOT, organizationId);
  if (!existsSync(dir)) return;

  const files = await readdir(dir);
  const now = Date.now();
  for (const file of files) {
    if (!file.endsWith(".pdf")) continue;
    const filePath = join(dir, file);
    try {
      const fileStat = await stat(filePath);
      if (now - fileStat.mtimeMs > REPORT_TTL_MS) {
        await rm(filePath);
      }
    } catch {
      // skip
    }
  }
}
