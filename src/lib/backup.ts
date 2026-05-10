/**
 * Sistem Backup/Restore pentru aplicația HR Management.
 *
 * - Creează arhive ZIP ale întregii aplicații: DB, documente, setări (adm-zip — Windows/Linux/macOS)
 * - Listează, descarcă, șterge backup-uri
 * - Restore din arhivă uploadată (cu backup automat pre-restore)
 * - Cleanup automat backup-uri vechi (>30 zile, configurabil)
 *
 * Cum configurezi backup automat:
 *   Windows Task Scheduler: rulează `curl -X POST http://localhost:3000/api/backup/create`
 *   Linux cron: `0 2 * * * curl -X POST http://localhost:3000/api/backup/create`
 *   Sau folosește setInterval în aplicație (dacă rulează 24/7)
 */

import AdmZip from "adm-zip";
import { readdir, stat, rm } from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";

// ─── Constants ───────────────────────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), "data");
const BACKUPS_DIR = join(DATA_DIR, "backups");
const DB_PATH = join(DATA_DIR, "app.db");
const DOCS_DIR = join(DATA_DIR, "documents");
const SETTINGS_DIR = join(DATA_DIR, "settings");

const DEFAULT_RETENTION_DAYS = 30;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BackupInfo {
  filename: string;
  size: number;
  createdAt: Date;
  sizeFormatted: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function sanitizeFilename(name: string): string {
  // Prevent path traversal
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Asigură `data/backups` (la fel ca în setup.js / start.js). */
function ensureBackupsDir(): void {
  if (!existsSync(BACKUPS_DIR)) {
    mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

/**
 * Creează ZIP la outputPath: app.db la rădăcină, apoi `documents/`, `settings/`.
 * Fișierele de la rădăcina `data/` urmează pattern-ul addLocalFile; folderele cu addLocalFolder.
 */
function writeApplicationZip(outputPath: string): void {
  const zip = new AdmZip();
  const filesToBackup = ["app.db"];

  for (const file of filesToBackup) {
    const filePath = join(DATA_DIR, file);
    if (existsSync(filePath)) {
      zip.addLocalFile(filePath, "", file);
    }
  }
  if (existsSync(DOCS_DIR)) {
    zip.addLocalFolder(DOCS_DIR, "documents");
  }
  if (existsSync(SETTINGS_DIR)) {
    zip.addLocalFolder(SETTINGS_DIR, "settings");
  }

  zip.writeZip(outputPath);
}

function zipListsAppDb(paths: string[]): boolean {
  return paths.some((p) => /(^|\/)app\.db$/i.test(p));
}

function zipHasDocumentsFolder(paths: string[]): boolean {
  return paths.some((p) => p === "documents" || p.startsWith("documents/"));
}

function readZipEntryPaths(zipPath: string): string[] {
  const zip = new AdmZip(zipPath);
  return zip.getEntries().map((e) => e.entryName.replace(/\\/g, "/"));
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Creează un backup ZIP.
 * Include: database, documents, settings.
 * Parola returnată este goală — arhiva este ZIP standard (compatibil Windows). Backup-uri vechi cu parolă (zip CLI) rămân restabile cu aceeași funcție restore.
 */
export async function createBackup(): Promise<{
  filename: string;
  path: string;
  size: number;
  password: string;
}> {
  ensureBackupsDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `backup_${timestamp}.zip`;
  const outputPath = join(BACKUPS_DIR, filename);

  const hasSomething =
    existsSync(DB_PATH) || existsSync(DOCS_DIR) || existsSync(SETTINGS_DIR);

  if (!hasSomething) {
    throw new Error("Niciun fișier de backup găsit");
  }

  await writeApplicationZip(outputPath);

  const stats = await stat(outputPath);

  return {
    filename,
    path: outputPath,
    size: stats.size,
    password: "",
  };
}

/**
 * Listează toate backup-urile disponibile.
 */
export async function listBackups(): Promise<BackupInfo[]> {
  if (!existsSync(BACKUPS_DIR)) return [];

  const files = await readdir(BACKUPS_DIR);
  const backups: BackupInfo[] = [];

  for (const filename of files) {
    if (!filename.endsWith(".zip")) continue;
    const filePath = join(BACKUPS_DIR, filename);
    try {
      const stats = await stat(filePath);
      backups.push({
        filename,
        size: stats.size,
        createdAt: stats.mtime,
        sizeFormatted: formatBytes(stats.size),
      });
    } catch {
      // skip files that can't be stat'd
    }
  }

  // Sort by date desc
  return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Returnează calea absolută către un fișier backup.
 * Verifică path traversal.
 */
export function getBackupPath(filename: string): string {
  const sanitized = sanitizeFilename(filename);
  const fullPath = resolve(join(BACKUPS_DIR, sanitized));

  // Path traversal check: ensure the resolved path is within BACKUPS_DIR
  const resolvedBackupsDir = resolve(BACKUPS_DIR);
  const normalizedFull = fullPath.replace(/\\/g, "/");
  const normalizedDir = (resolvedBackupsDir + "/").replace(/\\/g, "/");
  if (!normalizedFull.startsWith(normalizedDir) && normalizedFull.replace(/\/$/, "") !== resolvedBackupsDir.replace(/\\/g, "/")) {
    throw new Error("Path traversal detectat");
  }

  if (!existsSync(fullPath)) {
    throw new Error("Backup negasit");
  }

  return fullPath;
}

/**
 * Șterge un backup.
 */
export async function deleteBackup(filename: string): Promise<void> {
  const path = getBackupPath(filename);
  await rm(path);
}

/**
 * Creează un backup de siguranță înainte de restore.
 */
export async function createSafetyBackup(): Promise<string> {
  ensureBackupsDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `pre-restore_${timestamp}.zip`;
  const outputPath = join(BACKUPS_DIR, filename);

  const hasSomething =
    existsSync(DB_PATH) || existsSync(DOCS_DIR) || existsSync(SETTINGS_DIR);

  if (!hasSomething) {
    throw new Error("Niciun fișier de backupat");
  }

  writeApplicationZip(outputPath);

  return filename;
}

/**
 * Restaurează dintr-un fișier ZIP uploadat.
 * Creează automat un safety backup înainte.
 */
export async function restoreFromBackup(zipPath: string): Promise<{
  safetyBackup: string;
  restored: string[];
}> {
  const safetyBackup = await createSafetyBackup();

  const paths = readZipEntryPaths(zipPath);

  const hasDb = zipListsAppDb(paths);
  const hasDocs = zipHasDocumentsFolder(paths);

  if (!hasDb) {
    throw new Error("Arhiva nu contine baza de date (app.db)");
  }

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(DATA_DIR, true);

  const restored: string[] = ["Baza de date"];
  if (hasDocs) restored.push("Documente");
  restored.push("Setări");

  return { safetyBackup, restored };
}

/**
 * Șterge backup-uri mai vechi de retentionDays.
 */
export async function cleanupOldBackups(
  retentionDays: number = DEFAULT_RETENTION_DAYS
): Promise<{ deleted: number; freed: number }> {
  if (!existsSync(BACKUPS_DIR)) return { deleted: 0, freed: 0 };

  const files = await readdir(BACKUPS_DIR);
  const now = Date.now();
  const maxAge = retentionDays * 24 * 60 * 60 * 1000;

  let deleted = 0;
  let freed = 0;

  for (const filename of files) {
    if (!filename.endsWith(".zip")) continue;
    const filePath = join(BACKUPS_DIR, filename);
    try {
      const stats = await stat(filePath);
      if (now - stats.mtimeMs > maxAge) {
        freed += stats.size;
        await rm(filePath);
        deleted++;
      }
    } catch {
      // skip
    }
  }

  return { deleted, freed };
}

/**
 * Returnează statistici despre backup-uri.
 */
export async function getBackupStats(): Promise<{
  totalCount: number;
  totalSize: number;
  oldestBackup: Date | null;
  latestBackup: Date | null;
}> {
  const backups = await listBackups();

  if (backups.length === 0) {
    return { totalCount: 0, totalSize: 0, oldestBackup: null, latestBackup: null };
  }

  const first = backups[0];
  const last = backups[backups.length - 1];
  return {
    totalCount: backups.length,
    totalSize: backups.reduce((sum, b) => sum + b.size, 0),
    oldestBackup: last?.createdAt ?? null,
    latestBackup: first?.createdAt ?? null,
  };
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

  // Shuffle
  return pass.split("").sort(() => Math.random() - 0.5).join("");
}
