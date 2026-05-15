"use client";

import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { formatDate } from "@/components/admin/adminUtils";
import { Button } from "@/components/ui/button";
import { Database, Download, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type BackupInfo = {
  dbPath: string;
  sizeBytes: number;
  tableCount: number;
  latestBackup: string | null;
  backupCount: number;
  backupTotalSize: number;
};

export default function AdminBackupPage() {
  const [info, setInfo] = useState<BackupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/backup/info", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not load backup info");
      const payload = await response.json();
      setInfo(payload.info ?? null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unexpected error",
      );
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDownload(path: string, filename: string, key: string) {
    setDownloading(key);
    setError("");
    try {
      await downloadAdminExport(path, filename);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Download failed",
      );
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <AdminPageHeader
        title="Backup"
        description="Export database snapshots and platform-wide CSV reports."
      />

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <AdminTableSkeleton columns={2} />
      ) : !info ? (
        <AdminEmptyState
          title="Backup information unavailable"
          description="Could not read database metadata for this environment."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminStatCard
            title="Database size"
            value={formatAdminBytes(info?.sizeBytes ?? 0)}
            description={info?.dbPath ?? "-"}
          />
          <AdminStatCard
            title="Tables"
            value={String(info?.tableCount ?? 0)}
            description="SQLite user tables"
          />
          <AdminStatCard
            title="Latest backup"
            value={
              info?.latestBackup
                ? formatDate(info.latestBackup)
                : "No backup yet"
            }
            description={`${info?.backupCount ?? 0} stored backups`}
          />
          <AdminStatCard
            title="Backup storage"
            value={formatAdminBytes(info?.backupTotalSize ?? 0)}
            description="Total size of stored archives"
          />
        </div>
      )}

      <div className="grid gap-3">
        <Button
          disabled={Boolean(downloading)}
          onClick={() =>
            void handleDownload(
              "/api/admin/backup/export-database",
              `hr-management-${new Date().toISOString().slice(0, 10)}.db`,
              "db",
            )
          }
        >
          {downloading === "db" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Database className="h-4 w-4" />
          )}
          Export Database
        </Button>
        <Button
          variant="outline"
          disabled={Boolean(downloading)}
          onClick={() =>
            void handleDownload(
              "/api/admin/backup/export-users",
              `users-${new Date().toISOString().slice(0, 10)}.csv`,
              "users",
            )
          }
        >
          {downloading === "users" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export Users CSV
        </Button>
        <Button
          variant="outline"
          disabled={Boolean(downloading)}
          onClick={() =>
            void handleDownload(
              "/api/admin/backup/export-organizations",
              `organizations-${new Date().toISOString().slice(0, 10)}.csv`,
              "organizations",
            )
          }
        >
          {downloading === "organizations" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export Organizations CSV
        </Button>
      </div>
    </div>
  );
}

function formatAdminBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const size = bytes / 1024 ** index;
  return `${size.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

async function downloadAdminExport(path: string, filename: string) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? "Download failed");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function AdminStatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-2 break-all text-xs text-slate-500">{description}</p>
    </div>
  );
}
