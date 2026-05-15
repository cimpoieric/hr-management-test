import "server-only";

import { existsSync } from "fs";
import { join } from "path";
import { stat } from "fs/promises";
import { getBackupStats } from "@/lib/backup";
import { prismaBase as prisma } from "@/lib/prisma";

function resolveDatabasePath(): string {
  const raw = process.env.DATABASE_URL?.trim() ?? "";
  const match = raw.match(/^file:(.+)$/i);
  if (!match?.[1]) {
    return join(process.cwd(), "data", "app.db");
  }

  const relative = match[1].replace(/^\/+/, "");
  if (relative.startsWith("..")) {
    return join(process.cwd(), "prisma", relative);
  }
  return join(process.cwd(), relative);
}

export async function getAdminDatabaseInfo() {
  const dbPath = resolveDatabasePath();
  let sizeBytes = 0;
  if (existsSync(dbPath)) {
    const fileStat = await stat(dbPath);
    sizeBytes = fileStat.size;
  }

  const tableCountRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
    FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'
  `;
  const tableCount = Number(tableCountRows[0]?.count ?? 0);
  const backupStats = await getBackupStats();

  return {
    dbPath,
    sizeBytes,
    tableCount,
    latestBackup: backupStats.latestBackup?.toISOString() ?? null,
    backupCount: backupStats.totalCount,
    backupTotalSize: backupStats.totalSize,
  };
}

export function getDatabaseFilePath(): string {
  return resolveDatabasePath();
}
