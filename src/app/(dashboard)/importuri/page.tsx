"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Mail,
  Upload,
  Filter,
  Clock,
  CheckCircle2,
  Eye,
  Loader2,
  X,
  FileText,
  Inbox,
} from "lucide-react";
import { tImportStatus } from "@/messages";
import { ROUTES } from "@/lib/routes";

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

export default function ImporturiPage() {
  const [imports, setImports] = useState<PendingImport[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  const fetchImports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (sourceFilter) params.set("source", sourceFilter);

      const res = await fetch(`/api/import/pending?${params.toString()}`);
      if (!res.ok) throw new Error("Eroare");
      const data = await res.json();
      setImports(data.imports ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setImports([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sourceFilter]);

  useEffect(() => {
    fetchImports();
  }, [fetchImports]);

  function confidenceColor(score: number): string {
    if (score >= 0.8) return "text-green-600";
    if (score >= 0.5) return "text-amber-600";
    return "text-red-600";
  }

  function statusBadge(status: string) {
    const map: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
      PENDING: { bg: "bg-amber-100", text: "text-amber-700", icon: Clock, label: tImportStatus("PENDING") },
      APPROVED: { bg: "bg-green-100", text: "text-green-700", icon: CheckCircle2, label: tImportStatus("APPROVED") },
      REJECTED: { bg: "bg-red-100", text: "text-red-700", icon: X, label: tImportStatus("REJECTED") },
      DRAFT: { bg: "bg-blue-100", text: "text-blue-700", icon: FileText, label: tImportStatus("DRAFT") },
    };
    const c = map[status] ?? map["PENDING"]!;
    const Icon = c.icon;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
        <Icon size={10} />
        {c.label}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Importuri în așteptare</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} importuri în total — revizuiește și aprobă
          </p>
        </div>
        <Link
          href={ROUTES.importManual}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Upload size={16} />
          Upload manual
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Filter size={16} className="text-gray-400" />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border bg-white text-sm"
        >
          <option value="">Toate statusurile</option>
          <option value="PENDING">{tImportStatus("PENDING")}</option>
          <option value="DRAFT">{tImportStatus("DRAFT")}</option>
          <option value="APPROVED">{tImportStatus("APPROVED")}</option>
          <option value="REJECTED">{tImportStatus("REJECTED")}</option>
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border bg-white text-sm"
        >
          <option value="">Toate sursele</option>
          <option value="EMAIL">Email</option>
          <option value="MANUAL_UPLOAD">Upload manual</option>
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
            Reset
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Sursa</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Fișier</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Încredere</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Data</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                    Se încarcă...
                  </td>
                </tr>
              ) : imports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <Inbox size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-600 text-sm max-w-md mx-auto">
                      Niciun import în așteptare. Folosește butonul{" "}
                      <span className="font-medium text-gray-800">Upload manual</span> de sus pentru a
                      încărca fișiere.
                    </p>
                  </td>
                </tr>
              ) : (
                imports.map((imp) => (
                  <tr
                    key={imp.id}
                    className="border-b last:border-b-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-gray-500">#{imp.id}</td>
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
                      <span className="text-xs text-gray-400 ml-1">{imp.mimeType}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${confidenceColor(imp.confidenceScore)}`}>
                        {imp.confidenceScore > 0 ? `${Math.round(imp.confidenceScore * 100)}%` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{statusBadge(imp.status)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(imp.createdAt).toLocaleDateString("ro-RO")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`${ROUTES.imports}/${imp.id}`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Revizuiește importul"
                        >
                          <Eye size={16} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {imports.length > 0 && (
          <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-500">
            Afișate {imports.length} din {total} importuri
          </div>
        )}
      </div>
    </div>
  );
}
