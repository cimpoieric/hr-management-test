"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  FileText,
  FileImage,
  Download,
  Trash2,
  AlertTriangle,
  Filter,
  Eye,
  Search,
  Upload,
} from "lucide-react";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import {
  DocumentPreviewModal,
  type DocumentPreviewModalDocument,
} from "./DocumentPreviewModal";
import { DeleteDocumentDialog } from "./DeleteDocumentDialog";
import {
  DOCUMENT_TYPE_OPTIONS,
  getDocumentTypeLabel,
} from "@/lib/documentConstants";
import { ro } from "@/messages";
import {
  getDocumentExpiryBucket,
  countExpiryInDocuments,
} from "@/lib/documentExpiryUi";
import {
  HR_DOCUMENTS_CHANGED_EVENT,
  HR_DOCUMENTS_STORAGE_KEY,
  notifyDocumentsChanged,
} from "@/lib/documentsSync";

export type DocumentListFilteredStats = {
  total: number;
  expired: number;
  expiringSoon: number;
  alertDays: number;
  hasActiveFilters: boolean;
};

interface DocumentItem {
  id: number;
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
    new Date().toISOString();

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
          .employee_has_active_deployment
    ),
    downloadUrl: String(
      raw.downloadUrl ?? raw.download_url ?? `/api/documents/${raw.id}/download`
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
  const [allDocuments, setAllDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientStatusFilter>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [alertDays, setAlertDays] = useState(30);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);
  const [userRole, setUserRole] = useState<string>("");

  const previewModalDocument = useMemo((): DocumentPreviewModalDocument | null => {
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
    else if (low === "expiring" || low === "expiring_soon") setStatusFilter("EXPIRING");
    else if (raw.toUpperCase() === "VALID") setStatusFilter("VALID");
    urlStatusSynced.current = true;
  }, [searchParams]);

  useEffect(() => {
    void fetch("/api/documents/stats", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d != null && typeof d.documentAlertDays === "number") {
          const n = Number(d.documentAlertDays);
          if (Number.isFinite(n) && n > 0) setAlertDays(n);
        }
      })
      .catch(() => {});
  }, []);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (employeeId) params.set("employeeId", String(employeeId));
      const res = await fetch(`/api/documents?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Eroare");
      const data = await res.json();
      const rawList = (data.documents ?? []) as Record<string, unknown>[];
      setAllDocuments(rawList.map(mapApiDocument));
    } catch {
      setAllDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

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

  useEffect(() => {
    void fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user?.role) setUserRole(String(d.user.role));
      })
      .catch(() => {});
  }, []);

  const statsCallbackRef = useRef(onFilteredStatsChange);
  statsCallbackRef.current = onFilteredStatsChange;

  const filteredDocuments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allDocuments.filter((doc) => {
      if (typeFilter && doc.type !== typeFilter) return false;

      const bucket = getDocumentExpiryBucket(
        doc.status,
        doc.expiryDate,
        alertDays
      );
      if (statusFilter === "VALID" && bucket !== "valid") return false;
      if (statusFilter === "EXPIRED" && bucket !== "expired") return false;
      if (statusFilter === "EXPIRING" && bucket !== "expiring_soon") return false;

      if (q) {
        const emp = doc.employee;
        const full = emp
          ? `${emp.firstName} ${emp.lastName} ${emp.lastName} ${emp.firstName}`.toLowerCase()
          : "";
        const file = doc.fileName.toLowerCase();
        if (!full.includes(q) && !file.includes(q)) return false;
      }
      return true;
    });
  }, [allDocuments, typeFilter, statusFilter, searchQuery, alertDays]);

  const hasActiveFilters =
    Boolean(typeFilter) ||
    Boolean(statusFilter) ||
    searchQuery.trim().length > 0;

  const expiryCounts = useMemo(
    () => countExpiryInDocuments(filteredDocuments, alertDays),
    [filteredDocuments, alertDays]
  );

  useEffect(() => {
    if (loading) return;
    const cb = statsCallbackRef.current;
    if (!cb) return;
    cb({
      total: filteredDocuments.length,
      expired: expiryCounts.expired,
      expiringSoon: expiryCounts.expiringSoon,
      alertDays,
      hasActiveFilters,
    });
  }, [
    loading,
    filteredDocuments,
    alertDays,
    hasActiveFilters,
    expiryCounts.expired,
    expiryCounts.expiringSoon,
  ]);

  async function handleDownload(doc: DocumentItem) {
    try {
      const res = await fetch(doc.downloadUrl, { credentials: "include" });
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
      <div className={`flex items-center ${dense ? "justify-start" : "justify-end"} gap-1`}>
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
        <button
          type="button"
          onClick={() => setDeleteTarget(doc)}
          className={`cursor-pointer rounded-lg ${pad} text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600`}
          title="Ștergere"
          aria-label="Șterge document"
        >
          <Trash2 size={dense ? 18 : 16} />
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-400">Se încarcă...</div>
    );
  }

  const showFilteredEmpty =
    filteredDocuments.length === 0 && allDocuments.length > 0;
  const showGlobalEmpty = allDocuments.length === 0;

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
        userRole={userRole}
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
            placeholder="Căutați după nume angajat sau nume fișier…"
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
            }}
            className="text-sm text-gray-600 underline decoration-gray-400 underline-offset-2 hover:text-gray-900"
          >
            Resetează filtrele
          </button>
        )}
      </div>

      {showGlobalEmpty ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center shadow-sm">
          <FileText size={52} className="mx-auto text-gray-300" aria-hidden />
          <p className="mt-4 text-base font-medium text-gray-800">
            Încă nu există documente
          </p>
          <p className="mt-2 max-w-md mx-auto text-sm text-gray-500">
            Adăugați contracte, acte de identitate sau alte documente pentru a le
            urmări aici — cu reminder la expirare.
          </p>
          {onRequestUpload ? (
            <button
              type="button"
              onClick={onRequestUpload}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Upload size={16} aria-hidden />
              Încărcați primul document
            </button>
          ) : null}
        </div>
      ) : showFilteredEmpty ? (
        <div className="rounded-xl border bg-white px-6 py-12 text-center text-gray-500">
          <p className="text-sm font-medium text-gray-700">
            Niciun document nu corespunde filtrelor curente.
          </p>
          <button
            type="button"
            onClick={() => {
              setTypeFilter("");
              setStatusFilter("");
              setSearchQuery("");
            }}
            className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            Resetează filtrele
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
                  {filteredDocuments.map((doc) => {
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
                                  alertDays
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
            {filteredDocuments.map((doc) => {
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
                        {getDocumentTypeLabel(doc.type)} · {formatBytes(doc.fileSize)}
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
                      <dd className="font-medium text-gray-800">{doc.number ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">Emitere</dt>
                      <dd className="font-medium text-gray-800">{displayIssueDate(doc)}</dd>
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
              <span className="font-medium text-gray-800">{filteredDocuments.length}</span>{" "}
              documente în lista afișată
            </span>
            {expiryCounts.expired > 0 && (
              <span className="text-red-600">
                <AlertTriangle size={12} className="mr-1 inline" aria-hidden />
                {expiryCounts.expired} expirate
              </span>
            )}
            {expiryCounts.expiringSoon > 0 && (
              <span className="text-amber-700">
                {expiryCounts.expiringSoon} expiră curând
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
