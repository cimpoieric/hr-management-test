"use client";

import { useAuth } from "@/hooks/useAuth";
import { ro, tAuditAction, tAuditEntity } from "@/messages";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Filter,
  Loader2,
  Monitor,
  Search,
  Shield,
  User,
} from "lucide-react";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { UserRole } from "@/lib/roles";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: number | null;
  userId: number | null;
  userName: string | null;
  userRole: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditFilters {
  userId: string;
  entityType: string;
  action: string;
  dateFrom: string;
  dateTo: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ACTION_FILTER_VALUES = [
  "",
  "LOGIN",
  "LOGOUT",
  "LOGIN_FAILED",
  "CREATE",
  "UPDATE",
  "DELETE",
  "TIMESHEET_CREATED",
  "TIMESHEET_UPDATED",
  "TIMESHEET_DELETED",
  "PAYSLIP_CREATED",
  "PAYSLIP_SENT",
  "PAYSLIP_DELETED",
  "EMPLOYEE_CREATED",
  "EMPLOYEE_UPDATED",
  "EMPLOYEE_DELETED",
  "EMPLOYEE_IMPORTED",
  "DOCUMENT_UPLOADED",
  "DOCUMENT_DELETED",
  "VIEW",
  "EXPORT_EXCEL",
  "EXPORT_PDF",
  "REPORT_GENERATE",
  "IMPORT_APPROVE",
  "IMPORT_REJECT",
  "BACKUP",
  "PASSWORD_CHANGE",
  "SETTINGS_CHANGE",
] as const;

const ACTIONS = ACTION_FILTER_VALUES.map((value) => ({
  value,
  label: value === "" ? ro.audit.allActions : tAuditAction(value),
}));

const ENTITY_FILTER_VALUES = [
  "",
  "Employee",
  "Document",
  "Timesheet",
  "Payslip",
  "Payroll",
  "Deployment",
  "User",
  "Report",
  "System",
  "PendingImport",
  "Company",
  "Country",
] as const;

const ENTITIES = ENTITY_FILTER_VALUES.map((value) => ({
  value,
  label: value === "" ? ro.audit.allEntities : tAuditEntity(value),
}));

// ─── Component ───────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const { role } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [filters, setFilters] = useState<AuditFilters>({
    userId: "",
    entityType: "",
    action: "",
    dateFrom: "",
    dateTo: "",
  });

  // ── Fetch logs ──
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (filters.userId) params.set("userId", filters.userId);
      if (filters.entityType) params.set("entityType", filters.entityType);
      if (filters.action) params.set("action", filters.action);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Eroare");
        setLogs([]);
        setTotal(0);
        return;
      }

      const data = await res.json();
      setLogs(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError("Eroare de rețea");
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ── Export ──
  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.userId) params.set("userId", filters.userId);
      if (filters.entityType) params.set("entityType", filters.entityType);
      if (filters.action) params.set("action", filters.action);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);

      const res = await fetch(`/api/audit-logs/export?${params.toString()}`);
      if (!res.ok) {
        const d = await res.json();
        alert(d.error ?? "Eroare la export");
        setExporting(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Eroare la export");
    } finally {
      setExporting(false);
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const totalPages = Math.ceil(total / limit);
  const isAdmin = role === UserRole.ORG_ADMIN || role === UserRole.SUPER_ADMIN;

  // ═══ Render ═════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={ROUTES.settings}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
            <p className="text-sm text-gray-500">
              Istoric acțiuni — cine, ce, când, de unde
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={handleExport}
            disabled={exporting || total === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            {exporting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={14} />
            )}
            Export Excel
          </button>
        )}
      </div>

      {/* GDPR info */}
      <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg p-3">
        <Shield size={14} className="mt-0.5 shrink-0" />
        <p>
          Logurile de audit sunt păstrate conform GDPR Art. 5(1)(f). Nu se șterg
          decât după arhivare (1 an). IP-urile sunt din LAN.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filtre</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Acțiune */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Acțiune
            </label>
            <select
              value={filters.action}
              onChange={(e) => {
                setFilters((f) => ({ ...f, action: e.target.value }));
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
            >
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {/* Entitate */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Entitate
            </label>
            <select
              value={filters.entityType}
              onChange={(e) => {
                setFilters((f) => ({ ...f, entityType: e.target.value }));
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
            >
              {ENTITIES.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <Calendar size={10} className="inline mr-1" />
              De la
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => {
                setFilters((f) => ({ ...f, dateFrom: e.target.value }));
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
            />
          </div>

          {/* Date to */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <Calendar size={10} className="inline mr-1" />
              Până la
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => {
                setFilters((f) => ({ ...f, dateTo: e.target.value }));
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
            />
          </div>

          {/* User ID (admin only) */}
          {isAdmin && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                <User size={10} className="inline mr-1" />
                User ID
              </label>
              <input
                type="text"
                value={filters.userId}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, userId: e.target.value }));
                  setPage(1);
                }}
                placeholder="ID utilizator..."
                className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
              />
            </div>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">
          {loading ? "Se încarcă..." : `${total} intrări`}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">
                  Data
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Utilizator
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Acțiune
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Entitate
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  IP
                </th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 w-12">
                  Detalii
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    <Loader2 size={18} className="inline animate-spin mr-2" />
                    Se încarcă...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    {error ? (
                      <span className="text-red-500 flex items-center justify-center gap-2">
                        <AlertCircle size={16} />
                        {error}
                      </span>
                    ) : (
                      "Niciun log găsit"
                    )}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <Fragment key={log.id}>
                    <tr
                      key={log.id}
                      className="border-b last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => toggleExpand(log.id)}
                    >
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("ro-RO", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {log.userName ?? "System"}
                        </div>
                        {log.userRole && <RoleBadge role={log.userRole} />}
                      </td>
                      <td className="px-4 py-3">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-600">
                          {tAuditEntity(log.entity)}
                          {log.entityId && (
                            <span className="text-gray-400 ml-1">
                              #{log.entityId}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-gray-500">
                          <Monitor size={12} />
                          {log.ipAddress ?? "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {expandedId === log.id ? (
                          <EyeOff size={14} className="inline text-gray-400" />
                        ) : (
                          <Eye size={14} className="inline text-gray-400" />
                        )}
                      </td>
                    </tr>

                    {/* Expanded details */}
                    {expandedId === log.id && (
                      <tr key={`${log.id}-expanded`}>
                        <td
                          colSpan={6}
                          className="px-4 py-4 bg-slate-50 border-b"
                        >
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Old Values */}
                            {log.oldValues &&
                              Object.keys(log.oldValues).length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">
                                    Valori anterioare (old)
                                  </h4>
                                  <pre className="bg-white rounded-lg border p-3 text-xs text-gray-700 overflow-x-auto max-h-48 overflow-y-auto">
                                    {JSON.stringify(log.oldValues, null, 2)}
                                  </pre>
                                </div>
                              )}

                            {/* New Values */}
                            {log.newValues &&
                              Object.keys(log.newValues).length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-2">
                                    Valori noi (new)
                                  </h4>
                                  <pre className="bg-white rounded-lg border p-3 text-xs text-gray-700 overflow-x-auto max-h-48 overflow-y-auto">
                                    {JSON.stringify(log.newValues, null, 2)}
                                  </pre>
                                </div>
                              )}

                            {/* No values */}
                            {!log.oldValues && !log.newValues && (
                              <div className="lg:col-span-2 text-sm text-gray-400 text-center py-4">
                                Nicio valoare asociată acestei acțiuni.
                              </div>
                            )}
                          </div>

                          {log.userAgent && (
                            <div className="mt-3 text-xs text-gray-400">
                              User-Agent: {log.userAgent}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-sm text-gray-500">
              Pagina {page} din {totalPages} ({total} total)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper Components ───────────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const styles: Record<string, { bg: string; text: string }> = {
    LOGIN: { bg: "bg-green-100", text: "text-green-700" },
    LOGOUT: { bg: "bg-gray-100", text: "text-gray-700" },
    LOGIN_FAILED: { bg: "bg-red-100", text: "text-red-700" },
    CREATE: { bg: "bg-blue-100", text: "text-blue-700" },
    UPDATE: { bg: "bg-amber-100", text: "text-amber-700" },
    DELETE: { bg: "bg-red-100", text: "text-red-700" },
    VIEW: { bg: "bg-purple-100", text: "text-purple-700" },
    EXPORT_EXCEL: { bg: "bg-emerald-100", text: "text-emerald-700" },
    EXPORT_PDF: { bg: "bg-rose-100", text: "text-rose-700" },
    REPORT_GENERATE: { bg: "bg-cyan-100", text: "text-cyan-700" },
    IMPORT_APPROVE: { bg: "bg-teal-100", text: "text-teal-700" },
    IMPORT_REJECT: { bg: "bg-orange-100", text: "text-orange-700" },
    BACKUP: { bg: "bg-indigo-100", text: "text-indigo-700" },
    PASSWORD_CHANGE: { bg: "bg-pink-100", text: "text-pink-700" },
    SETTINGS_CHANGE: { bg: "bg-slate-100", text: "text-slate-700" },
    TIMESHEET_CREATED: { bg: "bg-blue-100", text: "text-blue-700" },
    TIMESHEET_UPDATED: { bg: "bg-amber-100", text: "text-amber-700" },
    TIMESHEET_DELETED: { bg: "bg-red-100", text: "text-red-700" },
    PAYSLIP_CREATED: { bg: "bg-emerald-100", text: "text-emerald-700" },
    PAYSLIP_SENT: { bg: "bg-teal-100", text: "text-teal-700" },
    PAYSLIP_DELETED: { bg: "bg-red-100", text: "text-red-700" },
    EMPLOYEE_CREATED: { bg: "bg-blue-100", text: "text-blue-700" },
    EMPLOYEE_UPDATED: { bg: "bg-amber-100", text: "text-amber-700" },
    EMPLOYEE_DELETED: { bg: "bg-red-100", text: "text-red-700" },
    EMPLOYEE_IMPORTED: { bg: "bg-indigo-100", text: "text-indigo-700" },
    DOCUMENT_UPLOADED: { bg: "bg-cyan-100", text: "text-cyan-700" },
    DOCUMENT_DELETED: { bg: "bg-red-100", text: "text-red-700" },
  };

  const s = styles[action] ?? { bg: "bg-gray-100", text: "text-gray-700" };
  const label = tAuditAction(action);

  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}
    >
      {label}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const configs: Record<string, { bg: string; text: string }> = {
    administrator: { bg: "bg-red-100", text: "text-red-700" },
    operator: { bg: "bg-blue-100", text: "text-blue-700" },
    doar_vizualizare: { bg: "bg-gray-100", text: "text-gray-700" },
  };
  const c = configs[role] ?? { bg: "bg-gray-100", text: "text-gray-600" };
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}
    >
      {role}
    </span>
  );
}
