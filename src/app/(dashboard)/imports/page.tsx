"use client";

import { useTranslation } from "@/hooks/useTranslation";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Inbox,
  Loader2,
  Mail,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface PendingImport {
  id: number;
  sourceType: string;
  sourceIcon: string;
  sourceLabel: string;
  fileName: string;
  mimeType: string;
  confidenceScore: number;
  status: string;
  employeeId: number | null;
  notes: string | null;
  createdAt: string;
}

function ImportsSuspenseFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex justify-center py-24 text-gray-400 text-sm">
      {t("pages.imports.loadingSuspense")}
    </div>
  );
}

function ImporturiPageContent() {
  const { t, currentLanguage } = useTranslation();
  const dateLocale = currentLanguage === "ro" ? "ro-RO" : "en-US";
  const searchParams = useSearchParams();
  const [imports, setImports] = useState<PendingImport[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    const raw = searchParams.get("status")?.trim();
    if (!raw) return;
    const low = raw.toLowerCase();
    if (low === "pending") {
      setStatusFilter("PENDING");
      return;
    }
    const up = raw.toUpperCase();
    if (
      ["PENDING", "DRAFT", "APPROVED", "REJECTED", "COMPLETED_UPDATE"].includes(
        up,
      )
    ) {
      setStatusFilter(up);
    }
  }, [searchParams]);

  const fetchImports = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setLoading(true);
      }
      try {
        const params = new URLSearchParams();
        if (statusFilter) params.set("status", statusFilter);
        if (sourceFilter) params.set("source", sourceFilter);

        const res = await fetch(`/api/import/pending?${params.toString()}`);
        if (!res.ok) throw new Error("fetch");
        const data = await res.json();
        setImports(data.imports ?? []);
        setTotal(data.total ?? 0);
      } catch {
        setImports([]);
        setTotal(0);
      } finally {
        if (!opts?.silent) {
          setLoading(false);
        }
      }
    },
    [statusFilter, sourceFilter],
  );

  useEffect(() => {
    fetchImports();
  }, [fetchImports]);

  function confidenceColor(score: number): string {
    if (score >= 0.8) return "text-green-600";
    if (score >= 0.5) return "text-amber-600";
    return "text-red-600";
  }

  async function handleDeleteImport(importRowId: number) {
    const ok = window.confirm(t("pages.imports.confirmDelete"));
    if (!ok) return;

    setDeletingId(importRowId);
    try {
      const res = await fetch(`/api/import/${importRowId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          typeof data.error === "string"
            ? data.error
            : t("pages.imports.toastDeleteFailed"),
        );
        return;
      }
      toast.success(t("pages.imports.toastDeleteSuccess"));
      await fetchImports({ silent: true });
    } catch {
      toast.error(t("components.toast.networkError"));
    } finally {
      setDeletingId(null);
    }
  }

  function statusBadge(status: string) {
    const map: Record<
      string,
      { bg: string; text: string; icon: React.ElementType }
    > = {
      PENDING: {
        bg: "bg-amber-100",
        text: "text-amber-700",
        icon: Clock,
      },
      APPROVED: {
        bg: "bg-green-100",
        text: "text-green-700",
        icon: CheckCircle2,
      },
      COMPLETED_UPDATE: {
        bg: "bg-emerald-100",
        text: "text-emerald-800",
        icon: CheckCircle2,
      },
      REJECTED: {
        bg: "bg-red-100",
        text: "text-red-700",
        icon: X,
      },
      DRAFT: {
        bg: "bg-blue-100",
        text: "text-blue-700",
        icon: FileText,
      },
    };
    const c = map[status] ?? map["PENDING"]!;
    const Icon = c.icon;
    const sk = `pages.imports.status.${status}`;
    const statusText = t(sk);
    const label = statusText === sk ? status : statusText;
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}
      >
        <Icon size={10} />
        {label}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("pages.imports.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("pages.imports.subtitle", {
              total,
              emDash: t("common.emDash"),
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={ROUTES.importSpreadsheet}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileSpreadsheet size={16} />
            Import Excel / CSV
          </Link>
          <Link
            href={ROUTES.importManual}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Upload size={16} />
            {t("pages.imports.manualUpload")}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Filter size={16} className="text-gray-400" />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border bg-white text-sm"
        >
          <option value="">{t("common.allStatuses")}</option>
          <option value="PENDING">
            {t("pages.imports.status.PENDING")}
          </option>
          <option value="DRAFT">{t("pages.imports.status.DRAFT")}</option>
          <option value="APPROVED">
            {t("pages.imports.status.APPROVED")}
          </option>
          <option value="COMPLETED_UPDATE">
            {t("pages.imports.status.COMPLETED_UPDATE")}
          </option>
          <option value="REJECTED">
            {t("pages.imports.status.REJECTED")}
          </option>
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border bg-white text-sm"
        >
          <option value="">{t("pages.imports.allSources")}</option>
          <option value="EMAIL">{t("pages.imports.sourceEmail")}</option>
          <option value="MANUAL_UPLOAD">
            {t("pages.imports.sourceManualUpload")}
          </option>
        </select>

        {(statusFilter || sourceFilter) && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter("");
              setSourceFilter("");
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            {t("common.reset")}
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  {t("pages.imports.columnId")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  {t("pages.imports.columnSource")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  {t("pages.imports.columnFile")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  {t("pages.imports.columnConfidence")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  {t("pages.imports.columnStatus")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  {t("pages.imports.columnDate")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">
                  {t("common.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr key="loading">
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                    {t("common.loading")}
                  </td>
                </tr>
              ) : imports.length === 0 ? (
                <tr key="empty">
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    <div className="py-8 text-center text-gray-500">
                      <Inbox size={48} className="mx-auto mb-4 text-gray-300" />
                      <p className="text-gray-600 text-sm max-w-md mx-auto">
                        {t("pages.imports.emptyStateBefore")}
                        <span className="font-medium text-gray-800">
                          {t("pages.imports.manualUpload")}
                        </span>
                        {t("pages.imports.emptyStateAfter")}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                imports.map((imp) => (
                  <tr
                    key={imp.id}
                    className="border-b last:border-b-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-gray-500">
                      #{imp.id}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        {imp.sourceType === "EMAIL" ? (
                          <Mail size={14} className="text-blue-500" />
                        ) : (
                          <Upload size={14} className="text-green-500" />
                        )}
                        <span className="text-gray-700">{imp.sourceLabel}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 truncate max-w-[200px] inline-block">
                        {imp.fileName}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">
                        {imp.mimeType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-medium ${confidenceColor(imp.confidenceScore)}`}
                      >
                        {imp.confidenceScore > 0
                          ? `${Math.round(imp.confidenceScore * 100)}%`
                          : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{statusBadge(imp.status)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(imp.createdAt).toLocaleDateString(dateLocale)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`${ROUTES.imports}/${imp.id}`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title={t("pages.imports.reviewImport")}
                        >
                          <Eye size={16} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleDeleteImport(imp.id)}
                          disabled={deletingId !== null}
                          className="p-1.5 rounded-lg border border-transparent text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-100 transition-colors disabled:opacity-50"
                          title={t("pages.imports.deleteImport")}
                          aria-label={t("pages.imports.deleteImport")}
                        >
                          <span className="inline-flex items-center justify-center shrink-0 w-4 h-4">
                            <span
                              className={cn(
                                "inline-flex",
                                deletingId !== imp.id && "hidden",
                              )}
                              aria-hidden={deletingId !== imp.id}
                            >
                              <Loader2 size={16} className="animate-spin" />
                            </span>
                            <span
                              className={cn(
                                "inline-flex",
                                deletingId === imp.id && "hidden",
                              )}
                              aria-hidden={deletingId === imp.id}
                            >
                              <Trash2 size={16} />
                            </span>
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-500 min-h-[2.75rem] flex items-center">
          {imports.length > 0 ? (
            <span>
              {t("pages.imports.footerShowing", {
                shown: imports.length,
                total,
              })}
            </span>
          ) : (
            <span className="text-gray-400">&nbsp;</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ImporturiPage() {
  return (
    <Suspense fallback={<ImportsSuspenseFallback />}>
      <ImporturiPageContent />
    </Suspense>
  );
}
