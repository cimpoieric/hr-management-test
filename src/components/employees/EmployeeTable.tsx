"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Eye,
  Pencil,
  Trash2,
  Building2,
  FileText,
  MapPin,
  Filter,
  X,
} from "lucide-react";
import { AdvancedFilter, defaultFilters, type FilterState } from "@/components/filters/AdvancedFilter";
import { BulkSelectionBar } from "@/components/tables/BulkSelection";

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  cnp: string;
  seriesCI?: string | null;
  numberCI?: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  status: string;
  address?: string | null;
  city: string | null;
  countryId: number | null;
  country: { id: number; name: string; code: string } | null;
  company: { id: number; name: string } | null;
  documentCount: number;
  deploymentCount: number;
  createdAt: string;
  hiredAt: string | null;
  bankName?: string | null;
  salaryType?: "LUNAR" | "SAPTAMANAL" | "ORA" | null;
  salaryAmount?: number | null;
  salaryCurrency?: string | null;
}

interface Company {
  id: number;
  name: string;
}

interface CountryOpt {
  id: number;
  name: string;
  code: string;
}

function statusesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function salaryTypePresetLabel(code: string): string {
  switch (code) {
    case "LUNAR":
      return "Plată lunară (LUNAR)";
    case "SAPTAMANAL":
      return "Plată săptămânală (SAPTAMANAL)";
    case "ORA":
      return "Plată pe oră (ORA)";
    default:
      return code;
  }
}

function statusPresetLabel(statuses: string[]): string {
  if (statuses.length === 1 && statuses[0] === "ACTIVE") return "Doar activi (ACTIVE)";
  if (statuses.length === 1 && statuses[0] === "TERMINATED") return "Doar terminați (TERMINATED)";
  return `Status: ${statuses.join(", ")}`;
}

interface EmployeeTableProps {
  initialData?: Employee[];
  initialTotal?: number;
  companies?: Company[];
  countries?: CountryOpt[];
  showAdvancedFilters?: boolean;
  showBulkActions?: boolean;
}

export function EmployeeTable({
  initialData = [],
  initialTotal = 0,
  companies = [],
  countries = [],
  showAdvancedFilters = true,
  showBulkActions = true,
}: EmployeeTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetStatusFromUrl = searchParams.get("status");
  const presetSalaryTypeFromUrl = searchParams.get("salaryType");

  // ── State ──
  const [employees, setEmployees] = useState<Employee[]>(initialData);
  const [loading, setLoading] = useState(initialData.length === 0);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Advanced filters
  const [filters, setFilters] = useState<FilterState>(() => ({
    ...defaultFilters,
    status: presetStatusFromUrl
      ? presetStatusFromUrl
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter((s) => s === "ACTIVE" || s === "TERMINATED")
      : defaultFilters.status,
  }));
  const [salaryTypeQuickFilter, setSalaryTypeQuickFilter] = useState(() => {
    const normalized = (presetSalaryTypeFromUrl ?? "").trim().toUpperCase();
    return normalized === "LUNAR" || normalized === "SAPTAMANAL" || normalized === "ORA"
      ? normalized
      : "";
  });
  const [filtersApplied, setFiltersApplied] = useState(false);

  const initialStatusFromUrlRef = useRef(
    (presetStatusFromUrl ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s === "ACTIVE" || s === "TERMINATED")
  );

  const showStatusPresetChip =
    initialStatusFromUrlRef.current.length > 0 &&
    statusesEqual(filters.status, initialStatusFromUrlRef.current);

  const syncUrlAfterPresetChange = useCallback(
    (options: { removeStatus?: boolean; removeSalaryType?: boolean }) => {
      const next = new URLSearchParams(window.location.search);
      if (options.removeStatus) next.delete("status");
      if (options.removeSalaryType) next.delete("salaryType");
      const q = next.toString();
      router.replace(q ? `/angajati?${q}` : "/angajati", { scroll: false });
    },
    [router]
  );

  const totalPages = Math.ceil(total / limit);

  // ── Build query params from filters ──
  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);

    if (filters.search) params.set("search", filters.search);
    if (filters.status.length > 0) params.set("status", filters.status.join(","));
    if (filters.company.length > 0) params.set("company", filters.company.join(","));
    if (filters.country.length > 0) params.set("country", filters.country.join(","));
    if (filters.employeeCountry.length > 0)
      params.set("employeeCountry", filters.employeeCountry.join(","));
    if (filters.expiredDocumentType) params.set("expiredDocumentType", filters.expiredDocumentType);
    if (filters.expiringSoon) params.set("expiringSoon", "true");
    if (filters.hireDateFrom) params.set("hireDateFrom", filters.hireDateFrom);
    if (filters.hireDateTo) params.set("hireDateTo", filters.hireDateTo);
    if (filters.hasAssignment) params.set("hasAssignment", "true");
    if (salaryTypeQuickFilter) params.set("salaryType", salaryTypeQuickFilter);

    return params;
  }, [page, limit, sortBy, sortOrder, filters, salaryTypeQuickFilter]);

  // ── Fetch employees ──
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const res = await fetch(`/api/employees?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Eroare fetch");

      const data = await res.json();
      setEmployees(data.data ?? []);
      setTotal(data.total ?? 0);
      // Reset selection on new data fetch
      setSelectedIds(new Set());
    } catch {
      setEmployees([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  // Fetch la mount și la schimbare parametri semnificativi
  useEffect(() => {
    if (initialData.length === 0 || filtersApplied) {
      fetchEmployees();
    }
  }, [fetchEmployees, initialData.length]);

  // ── Sort ──
  function toggleSort(field: string) {
    if (sortBy === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  }

  // ── Selection ──
  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === employees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(employees.map((e) => e.id)));
    }
  }

  function selectAllResults() {
    setSelectedIds(new Set(employees.map((e) => e.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // ── Delete ──
  async function handleDelete(id: number) {
    if (!confirm("Ești sigur că vrei să ștergi acest angajat?")) return;
    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchEmployees();
      } else {
        const data = await res.json();
        alert(data.error ?? "Eroare la ștergere");
      }
    } catch {
      alert("Eroare de rețea");
    }
  }

  // ── Filter actions ──
  function handleApplyFilters() {
    setFiltersApplied(true);
    setPage(1);
    fetchEmployees();
  }

  function handleResetFilters() {
    setFilters({ ...defaultFilters });
    setSalaryTypeQuickFilter("");
    setFiltersApplied(false);
    setPage(1);
    router.replace("/angajati", { scroll: false });
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <span className="w-4" />;
    return sortOrder === "asc" ? (
      <ChevronUp size={14} />
    ) : (
      <ChevronDown size={14} />
    );
  };

  // ── Active filter count ──
  const activeFilterCount = [
    filters.search,
    filters.status.length > 0,
    filters.company.length > 0,
    filters.country.length > 0,
    filters.employeeCountry.length > 0,
    filters.expiredDocumentType,
    filters.expiringSoon,
    filters.hireDateFrom,
    filters.hireDateTo,
    filters.hasAssignment,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <AdvancedFilter
          filters={filters}
          onChange={setFilters}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
          companies={companies}
          countries={countries}
        />
      )}

      {/* Quick search bar (always visible) */}
      {!showAdvancedFilters && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Caută după nume, email sau CNP..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
            />
            {filters.search && (
              <button
                onClick={() => setFilters((f) => ({ ...f, search: "" }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={filters.status[0] ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  status: e.target.value ? [e.target.value] : [],
                }))
              }
              className="px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
            >
              <option value="">Toate statusurile</option>
              <option value="ACTIVE">Activi</option>
              <option value="TERMINATED">Terminați</option>
            </select>
          </div>
        </div>
      )}

      {(salaryTypeQuickFilter || showStatusPresetChip) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm">
          <span className="text-slate-600 font-medium shrink-0">Filtre din link:</span>
          {showStatusPresetChip && (
            <button
              type="button"
              aria-label={`Elimină filtrul de status: ${statusPresetLabel(filters.status)}`}
              onClick={() => {
                setFilters((f) => ({ ...f, status: defaultFilters.status }));
                syncUrlAfterPresetChange({ removeStatus: true });
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-white text-slate-800 border border-slate-200 px-3 py-1 text-xs font-medium shadow-sm hover:bg-slate-50"
            >
              {statusPresetLabel(filters.status)}
              <X size={14} className="shrink-0 text-slate-500" aria-hidden />
            </button>
          )}
          {salaryTypeQuickFilter && (
            <button
              type="button"
              aria-label={`Elimină filtrul tip plată: ${salaryTypePresetLabel(salaryTypeQuickFilter)}`}
              onClick={() => {
                setSalaryTypeQuickFilter("");
                syncUrlAfterPresetChange({ removeSalaryType: true });
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-white text-slate-800 border border-slate-200 px-3 py-1 text-xs font-medium shadow-sm hover:bg-slate-50"
            >
              {salaryTypePresetLabel(salaryTypeQuickFilter)}
              <X size={14} className="shrink-0 text-slate-500" aria-hidden />
            </button>
          )}
        </div>
      )}

      {/* Bulk selection bar */}
      {showBulkActions && selectedIds.size > 0 && (
        <BulkSelectionBar
          selectedIds={Array.from(selectedIds)}
          totalResults={total}
          onClear={clearSelection}
          onSelectAllResults={selectAllResults}
        />
      )}

      {/* Results info + active filters badge */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">
          {loading ? "Se încarcă..." : `${total} rezultate`}
          {activeFilterCount > 0 && (
            <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {activeFilterCount} filtre active
            </span>
          )}
        </span>
        {selectedIds.size > 0 && (
          <span className="text-slate-600 bg-slate-100 px-3 py-1 rounded-lg text-sm">
            {selectedIds.size} selectați
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                {showBulkActions && (
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={
                        employees.length > 0 &&
                        selectedIds.size === employees.length
                      }
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                )}
                {[
                  { key: "lastName", label: "Nume" },
                  { key: "cnp", label: "CNP" },
                  { key: "company", label: "Firmă" },
                  { key: "position", label: "Funcție" },
                  { key: "salaryType", label: "Tip plată" },
                  { key: "salaryAmount", label: "Sumă" },
                  { key: "salaryCurrency", label: "Monedă" },
                  { key: "status", label: "Status" },
                  { key: "documents", label: "Doc." },
                  { key: "deployments", label: "Det." },
                ].map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                    onClick={() =>
                      col.key !== "documents" &&
                      col.key !== "deployments" &&
                      toggleSort(col.key)
                    }
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.key !== "documents" &&
                        col.key !== "deployments" && (
                          <SortIcon field={col.key} />
                        )}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={showBulkActions ? 12 : 11} className="px-4 py-12 text-center text-gray-400">
                    Se încarcă...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={showBulkActions ? 12 : 11} className="px-4 py-12 text-center text-gray-400">
                    {activeFilterCount > 0
                      ? "Niciun angajat găsit cu filtrele selectate"
                      : "Niciun angajat găsit"}
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="border-b last:border-b-0 hover:bg-gray-50 transition-colors"
                  >
                    {showBulkActions && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(emp.id)}
                          onChange={() => toggleSelect(emp.id)}
                          className="rounded"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {emp.lastName} {emp.firstName}
                      </div>
                      {emp.email && (
                        <div className="text-xs text-gray-400">{emp.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600">
                      {emp.cnp}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Building2 size={14} className="text-gray-400" />
                        {emp.company?.name ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {emp.position ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {emp.salaryType ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {typeof emp.salaryAmount === "number"
                        ? emp.salaryAmount.toLocaleString("ro-RO")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {emp.salaryCurrency ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={emp.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-500">
                        <FileText size={14} />
                        {emp.documentCount}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-500">
                        <MapPin size={14} />
                        {emp.deploymentCount}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/angajati/${emp.id}`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Vezi detalii"
                        >
                          <Eye size={16} />
                        </Link>
                        <Link
                          href={`/angajati/${emp.id}`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title="Editează"
                        >
                          <Pencil size={16} />
                        </Link>
                        <button
                          onClick={() => handleDelete(emp.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Șterge"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginare */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-sm text-gray-500">
              Pagina {page} din {totalPages} ({total} total)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
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

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    ACTIVE: { bg: "bg-green-100", text: "text-green-700", label: "Activ" },
    TERMINATED: { bg: "bg-red-100", text: "text-red-700", label: "Terminat" },
  };
  const c = config[status] ?? { bg: "bg-gray-100", text: "text-gray-700", label: status };

  return (
    <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
