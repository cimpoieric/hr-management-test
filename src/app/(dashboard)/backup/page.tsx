"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Database,
  Download,
  Trash2,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Upload,
  Check,
  Shield,
  HardDrive,
  Clock,
  ChevronRight,
  AlertCircle,
  X,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BackupInfo {
  filename: string;
  size: number;
  createdAt: string;
  sizeFormatted: string;
}

interface BackupStats {
  totalCount: number;
  totalSize: number;
  latestBackup: string | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BackupPage() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [lastCreated, setLastCreated] = useState<{
    filename: string;
    password: string;
  } | null>(null);

  // Restore states
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreStep, setRestoreStep] = useState<0 | 1 | 2 | 3>(0);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<string | null>(null);

  // ── Fetch ──
  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/backup/list");
      if (!res.ok) throw new Error("Eroare");
      const data = await res.json();
      setBackups(data.backups ?? []);
      setStats(data.stats ?? null);
    } catch {
      setError("Eroare la încărcarea backup-urilor");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  // ── Create ──
  async function handleCreate() {
    setCreating(true);
    setError("");
    setLastCreated(null);

    try {
      const res = await fetch("/api/backup/create", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Eroare");
        setCreating(false);
        return;
      }

      setLastCreated({
        filename: data.filename,
        password: data.password,
      });
      fetchBackups();
    } catch {
      setError("Eroare la creare backup");
    } finally {
      setCreating(false);
    }
  }

  // ── Delete ──
  async function handleDelete(filename: string) {
    if (!confirm(`Ștergi backup-ul "${filename}"?`)) return;

    setDeleting(filename);
    try {
      const res = await fetch(`/api/backup/download?filename=${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchBackups();
      } else {
        const d = await res.json();
        setError(d.error ?? "Eroare");
      }
    } catch {
      setError("Eroare la ștergere");
    } finally {
      setDeleting(null);
    }
  }

  // ── Download ──
  function handleDownload(filename: string) {
    const a = document.createElement("a");
    a.href = `/api/backup/download?filename=${encodeURIComponent(filename)}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ── Restore ──
  async function handleRestore() {
    if (!restoreFile) return;
    setRestoring(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("backup", restoreFile);

      const res = await fetch("/api/backup/restore", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Eroare la restaurare");
        setRestoring(false);
        return;
      }

      setRestoreResult(
        `Restaurare completă! Items restaurate: ${data.restored?.join(", ") ?? "N/A"}. Safety backup: ${data.safetyBackup}`
      );
      setRestoreStep(3);
      fetchBackups();
    } catch {
      setError("Eroare la restaurare");
    } finally {
      setRestoring(false);
    }
  }

  // Format bytes
  const formatBytes = (b: number) => {
    if (!b) return "0 B";
    const k = 1024;
    const s = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + " " + s[i];
  };

  // ═══ Render ═════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Database size={24} className="text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Backup & Restore</h1>
          <p className="text-sm text-gray-500">
            Creează, descarcă și restaurează backup-uri complete ale aplicației
          </p>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Shield size={14} />
            Status
          </div>
          <div className="text-lg font-semibold text-gray-900">
            {stats?.latestBackup
              ? "Backup activ"
              : "Fără backup"}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {stats?.latestBackup
              ? `Ultimul: ${new Date(stats.latestBackup).toLocaleString("ro-RO")}`
              : "Nu există backup-uri"}
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <HardDrive size={14} />
            Spațiu utilizat
          </div>
          <div className="text-lg font-semibold text-gray-900">
            {formatBytes(stats?.totalSize ?? 0)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {stats?.totalCount ?? 0} backup-uri stocate
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Clock size={14} />
            Politică retenție
          </div>
          <div className="text-lg font-semibold text-gray-900">30 zile</div>
          <div className="text-xs text-gray-400 mt-1">
            Backup-urile vechi se șterg automat
          </div>
        </div>
      </div>

      {/* Last created password display */}
      {lastCreated && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800 text-sm">
                Backup creat cu succes!
              </h3>
              <p className="text-xs text-amber-600 mt-1">
                {lastCreated.filename}
              </p>
              <div className="mt-2 bg-white rounded-lg border border-amber-200 p-3">
                <span className="text-xs text-amber-600 font-medium">
                  Parola arhivei (salveaz-o!):
                </span>
                <code className="block mt-1 text-sm font-mono text-amber-800 bg-amber-100 px-2 py-1 rounded">
                  {lastCreated.password}
                </code>
              </div>
            </div>
            <button
              onClick={() => setLastCreated(null)}
              className="text-amber-400 hover:text-amber-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Create button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {creating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          {creating ? "Se creează..." : "Creează backup acum"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg p-3">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Backup table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
          <span className="text-sm font-medium text-gray-700">Backup-uri stocate</span>
          <span className="text-xs text-gray-400">{backups.length} fișiere</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Data</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Nume fișier</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Dimensiune</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                    <Loader2 size={18} className="inline animate-spin mr-2" />
                    Se încarcă...
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                    Niciun backup stocat
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.filename} className="border-b last:border-b-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(b.createdAt).toLocaleString("ro-RO")}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {b.filename}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {b.sizeFormatted}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleDownload(b.filename)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Descarcă"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(b.filename)}
                          disabled={deleting === b.filename}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
                          title="Șterge"
                        >
                          {deleting === b.filename ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restore section */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-red-50">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-sm font-semibold text-red-700">Restaurare din backup</span>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {restoreStep === 0 && (
            <>
              <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
                <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
                <div className="text-sm text-red-700">
                  <p className="font-semibold">ATENȚIE — Operațiune distructivă!</p>
                  <p className="mt-1">
                    Restaurarea va suprascrie TOATE datele curente (bază de date, documente, setări)
                    cu cele din fișierul de backup. Datele create după backup vor fi pierdute definitiv.
                  </p>
                  <p className="mt-1">
                    Un safety backup al stării curente va fi creat automat înainte de restaurare.
                  </p>
                </div>
              </div>

              {/* Upload */}
              <div
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setRestoreFile(f); }}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-red-300 transition-colors cursor-pointer"
                onClick={() => document.getElementById("restore-upload")?.click()}
              >
                <input
                  id="restore-upload"
                  type="file"
                  accept=".zip"
                  onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <Upload size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-700">
                  {restoreFile ? restoreFile.name : "Click sau drag & drop fișier ZIP"}
                </p>
                <p className="text-xs text-gray-400 mt-1">Doar fișiere .zip</p>
              </div>

              <button
                onClick={() => restoreFile && setRestoreStep(1)}
                disabled={!restoreFile}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                Continuă
                <ChevronRight size={14} />
              </button>
            </>
          )}

          {restoreStep === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Confirmare pasul 1</h3>
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input type="checkbox" className="mt-0.5 rounded" id="confirm1" />
                <span className="text-sm text-gray-700">
                  Am înțeles că toate datele noi (adăugate după data backup-ului) vor fi pierdute definitiv.
                </span>
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setRestoreStep(0)}
                  className="px-4 py-2 rounded-lg border text-sm text-gray-700 hover:bg-gray-50"
                >
                  Înapoi
                </button>
                <button
                  onClick={() => {
                    const cb = document.getElementById("confirm1") as HTMLInputElement;
                    if (cb?.checked) setRestoreStep(2);
                  }}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                >
                  Continuă
                </button>
              </div>
            </div>
          )}

          {restoreStep === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Confirmare finală</h3>
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input type="checkbox" className="mt-0.5 rounded" id="confirm2" />
                <span className="text-sm text-gray-700">
                  Confirm restaurarea completă din fișierul{" "}
                  <strong>{restoreFile?.name}</strong>. Am salvat parola arhivei și știu că aplicația trebuie repornită după restaurare.
                </span>
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setRestoreStep(1)}
                  className="px-4 py-2 rounded-lg border text-sm text-gray-700 hover:bg-gray-50"
                >
                  Înapoi
                </button>
                <button
                  onClick={() => {
                    const cb = document.getElementById("confirm2") as HTMLInputElement;
                    if (cb?.checked) handleRestore();
                  }}
                  disabled={restoring}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {restoring && <Loader2 size={14} className="animate-spin" />}
                  {restoring ? "Se restaurează..." : "RESTAUREAZĂ ACUM"}
                </button>
              </div>
            </div>
          )}

          {restoreStep === 3 && restoreResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg p-4">
                <CheckCircle2 size={18} />
                <span className="font-medium">Restaurare completă!</span>
              </div>
              <p className="text-sm text-gray-600">{restoreResult}</p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
                <AlertTriangle size={14} className="inline mr-1" />
                <strong>Aplicația trebuie repornită</strong> pentru reconectarea la baza de date restaurată.
              </div>
              <button
                onClick={() => { setRestoreStep(0); setRestoreFile(null); setRestoreResult(null); }}
                className="px-4 py-2 rounded-lg border text-sm text-gray-700 hover:bg-gray-50"
              >
                Închide
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Auto backup info */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 text-sm text-blue-800">
        <h4 className="font-semibold mb-2">Backup automat</h4>
        <p className="mb-2">
          Pentru backup zilnic automat, configurează un task:
        </p>
        <div className="bg-white rounded-lg border p-3 font-mono text-xs text-gray-700 space-y-1">
          <p><strong>Windows (Task Scheduler):</strong></p>
          <p className="text-gray-500">Program: curl.exe</p>
          <p className="text-gray-500">Arguments: -X POST http://localhost:3000/api/backup/create -H "Cookie: token=YOUR_TOKEN"</p>
          <p className="text-gray-500 mt-2"><strong>Linux (cron):</strong></p>
          <p className="text-gray-500">0 2 * * * curl -X POST http://localhost:3000/api/backup/create -H "Cookie: token=YOUR_TOKEN"</p>
        </div>
      </div>
    </div>
  );
}
