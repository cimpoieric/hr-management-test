/**
 * Backup organizație (multi-tenant): export Prisma → ZIP în memorie → R2/S3.
 * Cheie: firm/{organizationId}/backup/{timestamp}.zip
 */

import "server-only";

import AdmZip from "adm-zip";
import { prisma } from "@/lib/prisma";
import {
  buildBackupFilename,
  buildBackupS3Key,
  deleteOrganizationBackup,
  getOrganizationBackupBuffer,
  listAllStoredBackups,
  listOrganizationBackups,
  putOrganizationBackup,
  sanitizeBackupFilename,
  type StoredBackupObject,
} from "@/lib/organizationBackupStorage";
import { s3PublicUrlForKey } from "@/lib/s3ObjectStorage";

const BACKUP_FORMAT_VERSION = 1;
const DEFAULT_RETENTION_DAYS = 30;

export interface BackupInfo {
  filename: string;
  size: number;
  createdAt: Date;
  sizeFormatted: string;
  downloadUrl?: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (
    Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  );
}

function toBackupInfo(entry: StoredBackupObject): BackupInfo {
  return {
    filename: entry.filename,
    size: entry.size,
    createdAt: entry.createdAt,
    sizeFormatted: formatBytes(entry.size),
  };
}

function serializeForBackup(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === "object" &&
    value !== null &&
    "toJSON" in value &&
    typeof (value as { toJSON: () => unknown }).toJSON === "function"
  ) {
    return (value as { toJSON: () => unknown }).toJSON();
  }
  if (Array.isArray(value)) {
    return value.map(serializeForBackup);
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = serializeForBackup(val);
    }
    return out;
  }
  return value;
}

async function exportOrganizationSnapshot(organizationId: string) {
  const employeeIds = (
    await prisma.employee.findMany({
      where: { organizationId },
      select: { id: true },
    })
  ).map((e) => e.id);

  const [
    organization,
    settings,
    companies,
    employees,
    users,
    documents,
    timesheets,
    payslips,
    pendingImports,
    deployments,
    salaryCalculations,
    employeeHistory,
  ] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.settings.findUnique({ where: { organizationId } }),
    prisma.company.findMany({ where: { organizationId } }),
    prisma.employee.findMany({ where: { organizationId } }),
    prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.document.findMany({ where: { organizationId } }),
    prisma.timesheet.findMany({ where: { organizationId } }),
    prisma.payslip.findMany({
      where: { organizationId },
      include: { items: true },
    }),
    prisma.pendingImport.findMany({ where: { organizationId } }),
    employeeIds.length > 0
      ? prisma.deployment.findMany({
          where: { employeeId: { in: employeeIds } },
        })
      : Promise.resolve([]),
    employeeIds.length > 0
      ? prisma.salaryCalculation.findMany({
          where: { employeeId: { in: employeeIds } },
        })
      : Promise.resolve([]),
    employeeIds.length > 0
      ? prisma.employeeHistory.findMany({
          where: { employeeId: { in: employeeIds } },
        })
      : Promise.resolve([]),
  ]);

  if (!organization) {
    throw new Error("Organizația nu a fost găsită");
  }

  return serializeForBackup({
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    organizationId,
    organization,
    settings,
    companies,
    employees,
    users,
    documents,
    timesheets,
    payslips,
    pendingImports,
    deployments,
    salaryCalculations,
    employeeHistory,
  });
}

function buildZipBufferFromSnapshot(snapshot: unknown): Buffer {
  const zip = new AdmZip();
  const manifest = JSON.stringify(
    {
      version: BACKUP_FORMAT_VERSION,
      format: "hr-management-organization-backup",
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );
  const data = JSON.stringify(snapshot, null, 2);

  zip.addFile("manifest.json", Buffer.from(manifest, "utf8"));
  zip.addFile("organization-backup.json", Buffer.from(data, "utf8"));

  return zip.toBuffer();
}

/**
 * Creează backup ZIP în memorie și îl salvează în R2 (sau disc local în dev).
 */
export async function createBackup(organizationId: string): Promise<{
  filename: string;
  size: number;
  password: string;
  downloadUrl: string | null;
  storageKey: string;
}> {
  const snapshot = await exportOrganizationSnapshot(organizationId);
  const buffer = buildZipBufferFromSnapshot(snapshot);

  if (buffer.length === 0) {
    throw new Error("Backup gol — nicio dată de exportat");
  }

  const filename = buildBackupFilename();
  const stored = await putOrganizationBackup(organizationId, filename, buffer);

  return {
    filename: sanitizeBackupFilename(filename),
    size: buffer.length,
    password: "",
    downloadUrl: stored.downloadUrl,
    storageKey: stored.key,
  };
}

export async function listBackups(organizationId: string): Promise<BackupInfo[]> {
  const entries = await listOrganizationBackups(organizationId);
  return entries.map(toBackupInfo);
}

export async function getBackupBuffer(
  organizationId: string,
  filename: string,
): Promise<Buffer> {
  return getOrganizationBackupBuffer(organizationId, filename);
}

export async function deleteBackup(
  organizationId: string,
  filename: string,
): Promise<void> {
  await deleteOrganizationBackup(organizationId, filename);
}

export async function createSafetyBackup(organizationId: string): Promise<string> {
  const snapshot = await exportOrganizationSnapshot(organizationId);
  const buffer = buildZipBufferFromSnapshot(snapshot);
  const filename = buildBackupFilename("pre-restore_");
  await putOrganizationBackup(organizationId, filename, buffer);
  return sanitizeBackupFilename(filename);
}

/**
 * Restaurare din arhivă uploadată (buffer în memorie).
 * Format nou: JSON organizație. Format vechi (app.db): respins pe PostgreSQL.
 */
export async function restoreFromBackupBuffer(
  organizationId: string,
  zipBuffer: Buffer,
): Promise<{
  safetyBackup: string;
  restored: string[];
}> {
  const safetyBackup = await createSafetyBackup(organizationId);
  const zip = new AdmZip(zipBuffer);
  const entryNames = zip
    .getEntries()
    .map((e) => e.entryName.replace(/\\/g, "/"));

  const hasLegacyDb = entryNames.some((p) => /(^|\/)app\.db$/i.test(p));
  if (hasLegacyDb) {
    throw new Error(
      "Arhiva conține app.db (format vechi SQLite). Restaurarea automată nu este disponibilă pe baza PostgreSQL. Descărcați datele manual sau contactați suportul.",
    );
  }

  const dataEntry = zip.getEntry("organization-backup.json");
  if (!dataEntry) {
    throw new Error(
      "Arhiva nu conține organization-backup.json (format backup curent).",
    );
  }

  const raw = dataEntry.getData().toString("utf8");
  const parsed = JSON.parse(raw) as { organizationId?: string };
  if (parsed.organizationId && parsed.organizationId !== organizationId) {
    throw new Error(
      "Backup-ul aparține altei organizații și nu poate fi restaurat aici.",
    );
  }

  throw new Error(
    "Restaurarea automată din backup cloud nu este încă activată. Backup-urile pot fi descărcate pentru arhivare; un safety backup a fost creat înainte de această încercare.",
  );
}

export async function cleanupOldBackups(
  organizationId: string,
  retentionDays: number = DEFAULT_RETENTION_DAYS,
): Promise<{ deleted: number; freed: number }> {
  const backups = await listOrganizationBackups(organizationId);
  const maxAge = retentionDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  let deleted = 0;
  let freed = 0;

  for (const backup of backups) {
    if (now - backup.createdAt.getTime() > maxAge) {
      await deleteOrganizationBackup(organizationId, backup.filename);
      freed += backup.size;
      deleted++;
    }
  }

  return { deleted, freed };
}

export async function getBackupStats(organizationId?: string): Promise<{
  totalCount: number;
  totalSize: number;
  oldestBackup: Date | null;
  latestBackup: Date | null;
}> {
  const backups = organizationId
    ? await listOrganizationBackups(organizationId)
    : await listAllStoredBackups();

  if (backups.length === 0) {
    return {
      totalCount: 0,
      totalSize: 0,
      oldestBackup: null,
      latestBackup: null,
    };
  }

  const sorted = [...backups].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return {
    totalCount: backups.length,
    totalSize: backups.reduce((sum, b) => sum + b.size, 0),
    latestBackup: sorted[0]?.createdAt ?? null,
    oldestBackup: sorted[sorted.length - 1]?.createdAt ?? null,
  };
}

export function buildBackupDownloadPath(filename: string): string {
  return `/api/backup/download?filename=${encodeURIComponent(sanitizeBackupFilename(filename))}`;
}

export function resolveBackupPublicUrl(
  organizationId: string,
  filename: string,
): string | null {
  return s3PublicUrlForKey(buildBackupS3Key(organizationId, filename));
}

/**
 * Generează parolă temporară puternică pentru useri noi.
 */
export function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const special = "!@#$%^&*";
  const all = upper + lower + numbers + special;

  let pass = "";
  pass += upper[Math.floor(Math.random() * upper.length)];
  pass += lower[Math.floor(Math.random() * lower.length)];
  pass += numbers[Math.floor(Math.random() * numbers.length)];
  pass += special[Math.floor(Math.random() * special.length)];

  for (let i = 4; i < 12; i++) {
    pass += all[Math.floor(Math.random() * all.length)];
  }

  return pass
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}
