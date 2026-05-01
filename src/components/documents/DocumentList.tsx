"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  FileImage,
  Download,
  Trash2,
  AlertTriangle,
  Filter,
  X,
  ChevronDown,
} from "lucide-react";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import { DOCUMENT_TYPES } from "@/lib/documentConstants";

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
  createdAt: string;
  employee?: { id: number; firstName: string; lastName: string } | null;
  downloadUrl: string;
}

const TYPE_LABELS: Record<string, string> = {
  CONTRACT: "Contract",
  ID: "Act identitate",
  MEDICAL: "Certificat medical",
  A1: "Formular A1",
  AUTHORIZATION: "Autorizație",
  VISA: "Viză",
  OTHER: "Altul",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  image: FileImage,
};

interface DocumentListProps {
  employeeId?: number;
  showEmployee?: boolean;
}

export function DocumentList({ employeeId, showEmployee = false }: DocumentListProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (employeeId) params.set("employeeId", String(employeeId));
      if (typeFilter) params.set("type", typeFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/documents?${params.toString()}`);
      if (!res.ok) throw new Error("Eroare");
      const data = await res.json();
      setDocuments(data.documents ?? []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId, typeFilter, statusFilter]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  async function handleDelete(id: number) {
    if (!confirm("Ești sigur că vrei să ștergi acest document?")) return;
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchDocuments();
      } else {
        const data = await res.json();
        alert(data.error ?? "Eroare la ștergere");
      }
    } catch {
      alert("Eroare de rețea");
    }
  }

  function formatDate(date: string | null): string {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("ro-RO");
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

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-400">Se încarcă...</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter size={16} className="text-gray-400" />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border bg-white text-sm"
        >
          <option value="">Toate tipurile</option>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t] ?? t}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border bg-white text-sm"
        >
          <option value="">Toate statusurile</option>
          <option value="VALID">Valid</option>
          <option value="EXPIRING_SOON">Expiră curând</option>
          <option value="EXPIRED">Expirat</option>
          <option value="PENDING">Pending</option>
        </select>
        {(typeFilter || statusFilter) && (
          <button
            onClick={() => {
              setTypeFilter("");
              setStatusFilter("");
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Reset
          </button>
        )}
      </div>

      {/* Table */}
      {documents.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl border">
          <FileText size={48} className="mx-auto mb-4 text-gray-300" />
          <p>Niciun document</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
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
                  const isExpired = doc.status === "EXPIRED";

                  return (
                    <tr
                      key={doc.id}
                      className={`border-b last:border-b-0 hover:bg-gray-50 transition-colors ${
                        isExpired ? "bg-red-50/50" : ""
                      }`}
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
                            <p className="font-medium text-gray-900 truncate max-w-[200px]">
                              {doc.fileName}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span>{TYPE_LABELS[doc.type] ?? doc.type}</span>
                              <span>·</span>
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
                        {formatDate(doc.issueDate)}
                      </td>

                      <td className="px-4 py-3">
                        {doc.expiryDate ? (
                          <span
                            className={
                              isExpired ? "text-red-600 font-medium" : "text-gray-600"
                            }
                          >
                            {formatDate(doc.expiryDate)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <DocumentStatusBadge status={doc.status} />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={doc.downloadUrl}
                            download
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Descarcă"
                          >
                            <Download size={16} />
                          </a>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Șterge"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-500">
            {documents.length} documente
            {documents.filter((d) => d.status === "EXPIRED").length > 0 && (
              <span className="ml-3 text-red-600">
                <AlertTriangle size={12} className="inline mr-1" />
                {documents.filter((d) => d.status === "EXPIRED").length} expirate
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
