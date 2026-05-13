"use client";

import { ROLES_EMPLOYEES_RW, ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import {
  DataEmptyState,
  DataErrorState,
  DataLoadingSpinner,
} from "@/components/shared/DataFetchStates";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import {
  DOCUMENT_TYPE_OPTIONS,
  getDocumentTypeLabel,
} from "@/lib/documentConstants";
import { getDocumentExpiryBucket } from "@/lib/documentExpiryUi";
import {
  HR_DOCUMENTS_CHANGED_EVENT,
  HR_DOCUMENTS_STORAGE_KEY,
  notifyDocumentsChanged,
} from "@/lib/documentsSync";
import { ro } from "@/messages";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileImage,
  FileText,
  Filter,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DeleteDocumentDialog } from "./DeleteDocumentDialog";
import {
  DocumentPreviewModal,
  type DocumentPreviewModalDocument,
} from "./DocumentPreviewModal";
import { DocumentStatusBadge } from "./DocumentStatusBadge";

export type DocumentListFilteredStats = {
  total: number;
  expired: number;
  expiringSoon: number;
  alertDays: number;
  hasActiveFilters: boolean;
};

interface DocumentItem {
  id: number;
  employeeId: number;
  type: string;
  number: string | null;
  fileName: string;
  status: string;
  fileSize: number;
  mimeType: string;
  issueDate: string | null;
  expiryDate: string | null;
  uploadedAt?: string | null;
  createdAt: string;
  employee?: { id: number; firstName: string; lastName: string } | null;
  employeeHasActiveDeployment?: boolean;
  downloadUrl: string;
}

function parseIsoField(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string" && v.trim().length > 0) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : v.trim();
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function mapApiDocument(raw: Record<string, unknown>): DocumentItem {
  const issue =
    parseIsoField(raw.issueDate) ??
    parseIsoField(raw.issue_date) ??
    parseIsoField((raw as { issueAt?: unknown }).issueAt);
  const expiry =
    parseIsoField(raw.expiryDate) ??
    parseIsoField(raw.expiry_date) ??
    parseIsoField((raw as { expiresAt?: unknown }).expiresAt);
  const uploaded =
    parseIsoField(raw.uploadedAt) ?? parseIsoField(raw.uploaded_at);
  const created =
    parseIsoField(raw.createdAt) ??
    parseIsoField(raw.created_at) ??
    uploaded ??
    "";

  const num =
    raw.number ??
    (raw as { docNumber?: unknown }).docNumber ??
    raw.documentNumber;
  const numberVal =
    typeof num === "string" && num.trim().length > 0
      ? num.trim()
      : num != null && String(num).trim().length > 0
        ? String(num).trim()
        : null;

  return {
    id: Number(raw.id),
    employeeId: Number(raw.employeeId ?? raw.employee_id ?? 0),
    type: String(raw.type ?? "").trim(),
    number: numberVal,
    fileName: String(raw.fileName ?? raw.file_name ?? ""),
    status: String(raw.status ?? ""),
    fileSize: Number(raw.fileSize ?? raw.file_size ?? 0),
    mimeType: String(raw.mimeType ?? raw.mime_type ?? ""),
    issueDate: issue,
    expiryDate: expiry,
    uploadedAt: uploaded,
    createdAt: created,
    employee: (raw.employee as DocumentItem["employee"]) ?? null,
    employeeHasActiveDeployment: Boolean(
      (raw as { employeeHasActiveDeployment?: unknown })
        .employeeHasActiveDeployment ??
      (raw as { employee_has_active_deployment?: unknown })
        .employee_has_active_deployment,
    ),
    downloadUrl: String(
      raw.downloadUrl ??
        raw.download_url ??
        `/api/documents/${raw.id}/download`,
    ),
  };
}

/** Valabil | Expirat | Expiră curând — filtrare după bucket dată. */
type ClientStatusFilter = "" | "VALID" | "EXPIRED" | "EXPIRING";

interface DocumentListProps {
  employeeId?: number;
  showEmployee?: boolean;
  onRequestUpload?: () => void;
  onFilteredStatsChange?: (stats: DocumentListFilteredStats) => void;
}

export function DocumentList({
  employeeId,
  showEmployee = false,
  onRequestUpload,
  onFilteredStatsChange,
}: DocumentListProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { role, can } = useAuth();
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientStatusFilter>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [listStats, setListStats] = useState({ expired: 0, expiringSoon: 0 });
  const [alertDays, setAlertDays] = useState(30);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);

  const previewModalDocument =
    useMemo((): DocumentPreviewModalDocument | null => {
      if (!previewDoc) return null;
      return {
        id: previewDoc.id,
        fileName: previewDoc.fileName,
        mimeType: previewDoc.mimeType,
        url: `/api/documents/${previewDoc.id}/file`,
        downloadUrl: previewDoc.downloadUrl,
        employee: previewDoc.employee,
      };
    }, [previewDoc]);

  const urlStatusSynced = useRef(false);
  useEffect(() => {
    if (urlStatusSynced.current) return;
    const raw = searchParams.get("status")?.trim();
    if (!raw) {
      urlStatusSynced.current = true;
      return;
    }
    const low = raw.toLowerCase();
    if (low === "expired") setStatusFilter("EXPIRED");
    else if (low === "expiring" || low === "expiring_soon")
      setStatusFilter("EXPIRING");
    else if (raw.toUpperCase() === "VALID") setStatusFilter("VALID");
    urlStatusSynced.current = true;
  }, [searchParams]);

  useEffect(() => {
    void fetch("/api/documents/stats", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d != null && typeof d.documentAlertDays === "number") {
          const n = Number(d.documentAlertDays);
          if (Number.isFinite(n) && n > 0) setAlertDays(n);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedSearch(searchQuery.trim()),
      400,
    );
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useLayoutEffect(() => {
    setPage(1);
  }, [typeFilter, statusFilter, debouncedSearch, employeeId]);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (employeeId) params.set("employeeId", String(employeeId));
      if (typeFilter) params.set("type", typeFilter);
      if (statusFilter === "EXPIRED") params.set("status", "EXPIRED");
      else if (statusFilter === "EXPIRING") params.set("status", "EXPIRING");
      else if (statusFilter === "VALID") params.set("status", "VALID");
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/documents?${params.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Eroare");
      const data = (await res.json()) as {
        documents?: Record<string, unknown>[];
        total?: number;
        totalPages?: number;
        page?: number;
        stats?: { expired?: number; expiringSoon?: number };
      };
      const rawList = data.documents ?? [];
      setDocuments(rawList.map(mapApiDocument));
      setTotal(Number(data.total) || 0);
      setTotalPages(Math.max(0, Number(data.totalPages) || 0));
      const st = data.stats;
      setListStats({
        expired: Number(st?.expired) || 0,
        expiringSoon: Number(st?.expiringSoon) || 0,
      });
    } catch {
      setLoadError(true);
      setDocuments([]);
      setTotal(0);
      setTotalPages(0);
      setListStats({ expired: 0, expiringSoon: 0 });
    } finally {
      setLoading(false);
    }
  }, [employeeId, typeFilter, statusFilter, debouncedSearch, page, limit]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    const run = () => {
      void fetchDocuments();
    };
    window.addEventListener(HR_DOCUMENTS_CHANGED_EVENT, run);
    const onStorage = (e: StorageEvent) => {
      if (e.key === HR_DOCUMENTS_STORAGE_KEY) run();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(HR_DOCUMENTS_CHANGED_EVENT, run);
      window.removeEventListener("storage", onStorage);
    };
  }, [fetchDocuments]);

  const statsCallbackRef = useRef(onFilteredStatsChange);
  statsCallbackRef.current = onFilteredStatsChange;

  const hasActiveFilters =
    Boolean(typeFilter) || Boolean(statusFilter) || debouncedSearch.length > 0;

  useEffect(() => {
    if (loading) return;
    const cb = statsCallbackRef.current;
    if (!cb) return;
    cb({
      total,
      expired: listStats.expired,
      expiringSoon: listStats.expiringSoon,
      alertDays,
      hasActiveFilters,
    });
  }, [
    loading,
    total,
    listStats.expired,
    listStats.expiringSoon,
    alertDays,
    hasActiveFilters,
  ]);

  async function handleDownload(doc: DocumentItem) {
    try {
      const res = await fetch(doc.downloadUrl, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        alert(data.error ?? "Eroare la descărcare");
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = doc.fileName || "document";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      alert("Eroare de rețea");
    }
  }

  function formatDate(date: string | null | undefined): string {
    if (date == null || date === "") return "—";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("ro-RO");
  }

  function displayIssueDate(doc: DocumentItem): string {
    const primary = formatDate(doc.issueDate);
    if (primary !== "—") return primary;
    const fromUpload = formatDate(doc.uploadedAt ?? null);
    if (fromUpload !== "—") return fromUpload;
    return formatDate(doc.createdAt);
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileIcon(mimeType: string) {
    if (mimeType.startsWith("image/")) return FileImage;
    return FileText;
  }

  function rowToneClass(doc: DocumentItem): string {
    const b = getDocumentExpiryBucket(doc.status, doc.expiryDate, alertDays);
    if (b === "expired") return "bg-red-50/60";
    if (b === "expiring_soon") return "bg-amber-50/50";
    return "";
  }

  function renderActions(doc: DocumentItem, dense?: boolean) {
    const pad = dense ? "p-2" : "p-1.5";
    return (
      <div
        className={`flex items-center ${dense ? "justify-start" : "justify-end"} gap-1`}
      >
        <button
          type="button"
          onClick={() => setPreviewDoc(doc)}
          className={`cursor-pointer rounded-lg ${pad} text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600`}
          title="Vizualizare"
          aria-label="Vizualizare document"
        >
          <Eye size={dense ? 18 : 16} />
        </button>
        <button
          type="button"
          onClick={() => void handleDownload(doc)}
          className={`cursor-pointer rounded-lg ${pad} text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600`}
          title="Descărcare"
          aria-label="Descarcă document"
        >
          <Download size={dense ? 18 : 16} />
        </button>
        <PermissionGuard allowedRoles={ROLES_SETTINGS_ADMIN}>
          <button
            type="button"
            onClick={() => setDeleteTarget(doc)}
            className={`cursor-pointer rounded-lg ${pad} text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600`}
            title="Ștergere"
            aria-label="Șterge document"
          >
            <Trash2 size={dense ? 18 : 16} />
          </button>
        </PermissionGuard>
      </div>
    );
  }

  if (loading && documents.length === 0 && total === 0 && !loadError) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <DataLoadingSpinner label={t("common.loading")} />
      </div>
    );
  }

  if (loadError && !loading && documents.length === 0 && total === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <DataErrorState
          message={t("components.dataFetchStates.loadFailed")}
          retryLabel={t("common.retry")}
          onRetry={() => void fetchDocuments()}
        />
      </div>
    );
  }

  const showFilteredEmpty =
    !loading && !loadError && total === 0 && hasActiveFilters;
  const showGlobalEmpty =
    !loading && !loadError && total === 0 && !hasActiveFilters;

  return (
    <div className="space-y-4">
      <DocumentPreviewModal
        document={previewModalDocument}
        onClose={() => setPreviewDoc(null)}
      />
      <DeleteDocumentDialog
        open={deleteTarget !== null}
        documentId={deleteTarget?.id ?? null}
        fileName={deleteTarget?.fileName ?? ""}
        status={deleteTarget?.status ?? ""}
        employeeHasActiveDeployment={
          deleteTarget?.employeeHasActiveDeployment ?? false
        }
        userRole={role ?? ""}
        onClose={() => setDeleteTarget(null)}
        onSuccess={() => {
          void fetchDocuments();
          router.refresh();
          notifyDocumentsChanged();
        }}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={16} className="shrink-0 text-gray-400" aria-hidden />
          <label className="sr-only">Tip document</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm sm:flex-initial sm:min-w-[11rem]"
          >
            <option value="">{ro.documents.filterAllTypes}</option>
            {DOCUMENT_TYPE_OPTIONS.map(({ code, label }) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
          <label className="sr-only">Status</label>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as ClientStatusFilter)
            }
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm sm:flex-initial sm:min-w-[12rem]"
          >
            <option value="">{ro.documents.filterAllStatuses}</option>
            <option value="VALID">Valabil</option>
            <option value="EXPIRED">Expirat</option>
            <option value="EXPIRING">
              Expiră curând (următoarele {alertDays} zile)
            </option>
          </select>
        </div>
        <div className="relative flex-1 sm:min-w-[200px] sm:max-w-md">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <label htmlFor="doc-search" className="sr-only">
            Căutare după angajat sau fișier
          </label>
          <input
            id="doc-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("pages.documentList.searchPlaceholder")}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none ring-blue-500 focus:ring-2"
          />
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setTypeFilter("");
              setStatusFilter("");
              setSearchQuery("");
              setDebouncedSearch("");
            }}
            className="text-sm text-gray-600 underline decoration-gray-400 underline-offset-2 hover:text-gray-900"
          >
            {t("pages.documentList.resetFilters")}
          </button>
        )}
      </div>

      {showGlobalEmpty ? (
        <DataEmptyState
          icon={FileText}
          title={t("pages.documentList.emptyTitle")}
          description={t("pages.documentList.emptyDescription")}
        >
          {onRequestUpload ? (
            <PermissionGuard allowedRoles={ROLES_EMPLOYEES_RW}>
              <Button
                type="button"
                onClick={onRequestUpload}
                className="bg-slate-900 text-white hover:bg-slate-800"
              >
                <Upload size={16} aria-hidden className="mr-2" />
                {t("pages.documentList.uploadFirst")}
              </Button>
            </PermissionGuard>
          ) : null}
        </DataEmptyState>
      ) : showFilteredEmpty ? (
        <div className="rounded-xl border bg-white px-6 py-12 text-center text-gray-500 shadow-sm">
          <p className="text-sm font-medium text-gray-700">
            {t("pages.documentList.filteredEmpty")}
          </p>
          <button
            type="button"
            onClick={() => {
              setTypeFilter("");
              setStatusFilter("");
              setSearchQuery("");
              setDebouncedSearch("");
            }}
            className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            {t("pages.documentList.resetFilters")}
          </button>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-600">
                      Document
                    </th>
                    {showEmployee && (
                      <th className="px-4 py-3 text-left font-medium text-gray-600">
                        Angajat
                      </th>
                    )}
                    <th className="px-4 py-3 text-left font-medium text-gray-600">
                      Nr.
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">
                      Emitere
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">
                      Expirare
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">
                      Acțiuni
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => {
                    const Icon = getFileIcon(doc.mimeType);
                    const tone = rowToneClass(doc);

                    return (
                      <tr
                        key={doc.id}
                        className={`border-b border-gray-100 last:border-b-0 hover:bg-gray-50/80 ${tone}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Icon
                              size={18}
                              className={
                                doc.mimeType.startsWith("image/")
                                  ? "text-purple-500"
                                  : "text-blue-500"
                              }
                            />
                            <div className="min-w-0">
                              <p className="max-w-[220px] truncate font-medium text-gray-900">
                                {doc.fileName}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                                <span>{getDocumentTypeLabel(doc.type)}</span>
                                <span aria-hidden>·</span>
                                <span>{formatBytes(doc.fileSize)}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        {showEmployee && (
                          <td className="px-4 py-3 text-gray-600">
                            {doc.employee
                              ? `${doc.employee.lastName} ${doc.employee.firstName}`
                              : "—"}
                          </td>
                        )}
                        <td className="px-4 py-3 text-gray-600">
                          {doc.number ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {displayIssueDate(doc)}
                        </td>
                        <td className="px-4 py-3">
                          {doc.expiryDate ? (
                            <span
                              className={
                                getDocumentExpiryBucket(
                                  doc.status,
                                  doc.expiryDate,
                                  alertDays,
                                ) === "expired"
                                  ? "font-medium text-red-600"
                                  : "text-gray-600"
                              }
                            >
                              {formatDate(doc.expiryDate)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <DocumentStatusBadge
                            status={doc.status}
                            expiryDate={doc.expiryDate}
                            expiringSoonDays={alertDays}
                          />
                        </td>
                        <td className="px-4 py-3">{renderActions(doc)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {documents.map((doc) => {
              const Icon = getFileIcon(doc.mimeType);
              return (
                <article
                  key={doc.id}
                  className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${rowToneClass(doc)}`}
                >
                  <div className="flex gap-3">
                    <Icon
                      size={22}
                      className={
                        doc.mimeType.startsWith("image/")
                          ? "shrink-0 text-purple-500"
                          : "shrink-0 text-blue-500"
                      }
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug text-gray-900">
                        {doc.fileName}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {getDocumentTypeLabel(doc.type)} ·{" "}
                        {formatBytes(doc.fileSize)}
                      </p>
                    </div>
                  </div>
                  {showEmployee && doc.employee && (
                    <p className="mt-3 text-sm text-gray-600">
                      <span className="text-gray-400">Angajat: </span>
                      {doc.employee.lastName} {doc.employee.firstName}
                    </p>
                  )}
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-3">
                    <div>
                      <dt className="text-gray-400">Nr.</dt>
                      <dd className="font-medium text-gray-800">
                        {doc.number ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">Emitere</dt>
                      <dd className="font-medium text-gray-800">
                        {displayIssueDate(doc)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">Expirare</dt>
                      <dd className="font-medium text-gray-800">
                        {doc.expiryDate ? formatDate(doc.expiryDate) : "—"}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                    <DocumentStatusBadge
                      status={doc.status}
                      expiryDate={doc.expiryDate}
                      expiringSoonDays={alertDays}
                    />
                    {renderActions(doc, true)}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-600">
            <span>
              <span className="font-medium text-gray-800">{total}</span>{" "}
              documente care corespund filtrelor
              {totalPages > 1 ? (
                <>
                  {" "}
                  (pagina {page}/{totalPages}, afișate {documents.length})
                </>
              ) : null}
            </span>
            {listStats.expired > 0 && (
              <span className="text-red-600">
                <AlertTriangle size={12} className="mr-1 inline" aria-hidden />
                {listStats.expired} expirate
              </span>
            )}
            {listStats.expiringSoon > 0 && (
              <span className="text-amber-700">
                {listStats.expiringSoon} expiră curând
              </span>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
              <span>
                Pagina {page} din {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Pagina anterioară"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Pagina următoare"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
