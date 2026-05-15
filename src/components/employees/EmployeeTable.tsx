"use client";

import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import {
  AdvancedFilter,
  type FilterState,
  defaultFilters,
} from "@/components/filters/AdvancedFilter";
import { BulkSelectionBar } from "@/components/tables/BulkSelection";
import {
  DataEmptyState,
  DataErrorState,
  EmployeeTableSkeletonBody,
} from "@/components/shared/DataFetchStates";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import type { EmployeeKpiStats } from "@/lib/employeeStats";
import { ROUTES } from "@/lib/routes";
import type { TFunction } from "i18next";
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  FileText,
  Filter,
  MapPin,
  Pencil,
  Search,
  Trash,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { CompanyOption, CountryOption, EmployeeListApiRow } from "@/types";

function statusesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function salaryTypePresetLabel(code: string, t: TFunction): string {
  switch (code) {
    case "LUNAR":
      return t("components.employeeTable.salaryMonthly");
    case "SAPTAMANAL":
      return t("components.employeeTable.salaryWeekly");
    case "ORA":
      return t("components.employeeTable.salaryHourly");
    default:
      return code;
  }
}

function statusPresetLabel(statuses: string[], t: TFunction): string {
  if (statuses.length === 1 && statuses[0] === "ACTIVE")
    return t("components.employeeTable.statusChipActiveOnly");
  if (statuses.length === 1 && statuses[0] === "TERMINATED")
    return t("components.employeeTable.statusChipTerminatedOnly");
  return t("components.employeeTable.statusChipPrefix", {
    list: statuses.join(", "),
  });
}

interface EmployeeTableProps {
  initialData?: EmployeeListApiRow[];
  initialTotal?: number;
  companies?: CompanyOption[];
  countries?: CountryOption[];
  showAdvancedFilters?: boolean;
  showBulkActions?: boolean;
  /** KPI din aceleași funcții ca panoul (fără filtre pe listă). */
  canonicalKpi?: EmployeeKpiStats | null;
}

export function EmployeeTable({
  initialData = [],
  initialTotal = 0,
  companies = [],
  countries = [],
  showAdvancedFilters = true,
  showBulkActions = true,
  canonicalKpi = null,
}: EmployeeTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useAuth();
  const { t, i18n } = useTranslation();
  const numberLocale = i18n.language?.startsWith("ro") ? "ro-RO" : "en-US";
  const presetStatusFromUrl = searchParams.get("status");
  const presetSalaryTypeFromUrl = searchParams.get("salaryType");

  // ── State ──
  const [employees, setEmployees] = useState<EmployeeListApiRow[]>(initialData);
  const [loading, setLoading] = useState(initialData.length === 0);
  const [loadError, setLoadError] = useState(false);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [permanentDeleteOpen, setPermanentDeleteOpen] = useState(false);
  const [employeeIdPermanentDelete, setEmployeeIdPermanentDelete] = useState<
    number | null
  >(null);
  const [permanentDeleting, setPermanentDeleting] = useState(false);

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
    return normalized === "LUNAR" ||
      normalized === "SAPTAMANAL" ||
      normalized === "ORA"
      ? normalized
      : "";
  });
  const [filtersApplied, setFiltersApplied] = useState(false);

  const initialStatusFromUrlRef = useRef(
    (presetStatusFromUrl ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s === "ACTIVE" || s === "TERMINATED"),
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
      router.replace(q ? `${ROUTES.employees}?${q}` : ROUTES.employees, {
        scroll: false,
      });
    },
    [router],
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
    if (filters.status.length > 0)
      params.set("status", filters.status.join(","));
    if (filters.company.length > 0)
      params.set("company", filters.company.join(","));
    if (filters.country.length > 0)
      params.set("country", filters.country.join(","));
    if (filters.employeeCountry.length > 0)
      params.set("employeeCountry", filters.employeeCountry.join(","));
    if (filters.expiredDocumentType)
      params.set("expiredDocumentType", filters.expiredDocumentType);
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
    setLoadError(false);
    try {
      const params = buildParams();
      const res = await fetch(`/api/employees?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("fetch failed");

      const data = await res.json();
      setEmployees(data.data ?? []);
      setTotal(data.total ?? 0);
      // Reset selection on new data fetch
      setSelectedIds(new Set());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  // Fetch la mount și la schimbare parametri semnificativi
  useEffect(() => {
    if (initialData.length === 0 || filtersApplied) {
      fetchEmployees();
    }
  }, [fetchEmployees, initialData.length, filtersApplied]);

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

  // ── Soft delete (status TERMINATED) ──
  async function handleSoftDelete(id: number) {
    if (!confirm(t("components.employeeTable.confirmSoftTerminate"))) return;
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (res.ok) {
        toast.success(t("components.toast.employeeMarkedTerminated"));
        fetchEmployees();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? t("components.toast.employeeTerminateError"));
      }
    } catch {
      toast.error(t("components.toast.networkError"));
    }
  }

  function openPermanentDeleteDialog(id: number) {
    setEmployeeIdPermanentDelete(id);
    setPermanentDeleteOpen(true);
  }

  async function handleConfirmPermanentDelete() {
    if (employeeIdPermanentDelete == null) return;
    setPermanentDeleting(true);
    try {
      const res = await fetch(
        `/api/employees/${employeeIdPermanentDelete}?permanent=true`,
        { method: "DELETE", credentials: "same-origin" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        error?: string;
      };
      if (res.ok && data.success) {
        toast.success(t("components.employeeTable.permanentDeleteSuccess"));
        setPermanentDeleteOpen(false);
        setEmployeeIdPermanentDelete(null);
        fetchEmployees();
        return;
      }
      toast.error(
        data.error ?? t("components.toast.employeePermanentDeleteFail"),
      );
    } catch {
      toast.error(t("components.toast.networkError"));
    } finally {
      setPermanentDeleting(false);
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
    router.replace(ROUTES.employees, { scroll: false });
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field)
      return <span className="inline-block w-4 shrink-0" aria-hidden />;
    return sortOrder === "asc" ? (
      <ChevronUp size={14} className="shrink-0" aria-hidden />
    ) : (
      <ChevronDown size={14} className="shrink-0" aria-hidden />
    );
  };

  type EmployeeTableColumnKey =
    | "lastName"
    | "cnp"
    | "company"
    | "position"
    | "salaryType"
    | "salaryAmount"
    | "salaryCurrency"
    | "status"
    | "documents"
    | "deployments";

  const tableColumns: {
    key: EmployeeTableColumnKey;
    label: string;
    thClass: string;
  }[] = useMemo(
    () => [
      {
        key: "lastName",
        label: t("components.employeeTable.colLastName"),
        thClass: "w-[15%] min-w-0",
      },
      {
        key: "cnp",
        label: t("components.employeeTable.colCnp"),
        thClass: "w-[9%] min-w-0 max-2xl:w-[8%]",
      },
      {
        key: "company",
        label: t("components.employeeTable.colCompany"),
        thClass: "w-[14%] min-w-0",
      },
      {
        key: "position",
        label: t("components.employeeTable.colPosition"),
        thClass: "w-[11%] min-w-0 max-2xl:w-[10%]",
      },
      {
        key: "salaryType",
        label: t("components.employeeTable.colSalaryType"),
        thClass: "w-[8%] min-w-0",
      },
      {
        key: "salaryAmount",
        label: t("components.employeeTable.colAmount"),
        thClass: "w-[9%] min-w-0",
      },
      {
        key: "salaryCurrency",
        label: t("components.employeeTable.colCurrency"),
        thClass: "w-[5%] min-w-0",
      },
      {
        key: "status",
        label: t("components.employeeTable.colStatus"),
        thClass: "w-[8%] min-w-0",
      },
      {
        key: "documents",
        label: t("components.employeeTable.colDocuments"),
        thClass: "w-[5%] min-w-0",
      },
      {
        key: "deployments",
        label: t("components.employeeTable.colDeployments"),
        thClass: "w-[5%] min-w-0",
      },
    ],
    [t],
  );

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

      {canonicalKpi && (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <span className="font-semibold text-slate-800">
            {t("components.employeeTable.kpiIntro")}
          </span>{" "}
          {t("components.employeeTable.kpiLinePart1", {
            total: canonicalKpi.totalEmployees,
          })}{" "}
          {t("components.employeeTable.kpiLinePart2", {
            active: canonicalKpi.activeEmployees,
          })}{" "}
          <span className="font-mono font-medium tabular-nums">
            {canonicalKpi.monthlySalaryCostRon.toLocaleString(numberLocale)} RON
          </span>
          {t("components.employeeTable.kpiLinePart3")}
        </p>
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
              onChange={(e) =>
                setFilters((f) => ({ ...f, search: e.target.value }))
              }
              placeholder={t("components.employeeTable.searchPlaceholder")}
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
              <option value="">
                {t("components.employeeTable.allStatuses")}
              </option>
              <option value="ACTIVE">
                {t("components.employeeTable.statusActiveOption")}
              </option>
              <option value="TERMINATED">
                {t("components.employeeTable.statusTerminatedOption")}
              </option>
            </select>
          </div>
        </div>
      )}

      {(salaryTypeQuickFilter || showStatusPresetChip) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm">
          <span className="text-slate-600 font-medium shrink-0">
            {t("components.employeeTable.presetFiltersFromLink")}
          </span>
          {showStatusPresetChip && (
            <button
              type="button"
              aria-label={t("components.employeeTable.removeStatusFilterAria", {
                label: statusPresetLabel(filters.status, t),
              })}
              onClick={() => {
                setFilters((f) => ({ ...f, status: defaultFilters.status }));
                syncUrlAfterPresetChange({ removeStatus: true });
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-white text-slate-800 border border-slate-200 px-3 py-1 text-xs font-medium shadow-sm hover:bg-slate-50"
            >
              {statusPresetLabel(filters.status, t)}
              <X size={14} className="shrink-0 text-slate-500" aria-hidden />
            </button>
          )}
          {salaryTypeQuickFilter && (
            <button
              type="button"
              aria-label={t("components.employeeTable.removeSalaryFilterAria", {
                label: salaryTypePresetLabel(salaryTypeQuickFilter, t),
              })}
              onClick={() => {
                setSalaryTypeQuickFilter("");
                syncUrlAfterPresetChange({ removeSalaryType: true });
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-white text-slate-800 border border-slate-200 px-3 py-1 text-xs font-medium shadow-sm hover:bg-slate-50"
            >
              {salaryTypePresetLabel(salaryTypeQuickFilter, t)}
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
          {loading
            ? t("common.loading")
            : loadError
              ? t("components.dataFetchStates.loadFailed")
              : t("components.employeeTable.resultsCount", { count: total })}
          {activeFilterCount > 0 && (
            <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {t("components.employeeTable.activeFiltersBadge", {
                count: activeFilterCount,
              })}
            </span>
          )}
        </span>
        {selectedIds.size > 0 && (
          <span className="text-slate-600 bg-slate-100 px-3 py-1 rounded-lg text-sm">
            {t("components.employeeTable.selectedCount", {
              count: selectedIds.size,
            })}
          </span>
        )}
      </div>

      {/* Table — table-fixed + truncare pe laptop; coloana Acțiuni sticky la dreapta dacă apare scroll orizontal */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="w-full min-w-0 overflow-x-auto xl:overflow-x-visible [scrollbar-gutter:stable]">
          <table className="w-full max-w-full table-fixed border-separate border-spacing-0 text-sm max-2xl:text-[13px]">
            <thead>
              <tr className="border-b bg-gray-50">
                {showBulkActions && (
                  <th className="sticky left-0 z-30 w-10 px-2 py-2.5 max-2xl:px-2 max-2xl:py-2 bg-gray-50 border-r border-gray-200/80 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.08)]">
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
                {tableColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-2 py-2.5 max-2xl:px-1.5 max-2xl:py-2 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none min-w-0 ${col.thClass ?? ""} ${
                      col.key !== "documents" && col.key !== "deployments"
                        ? ""
                        : "cursor-default hover:text-gray-600"
                    }`}
                    onClick={() =>
                      col.key !== "documents" &&
                      col.key !== "deployments" &&
                      toggleSort(col.key)
                    }
                  >
                    <div className="flex items-center gap-0.5 min-w-0">
                      <span className="truncate">{col.label}</span>
                      {col.key !== "documents" && col.key !== "deployments" && (
                        <SortIcon field={col.key} />
                      )}
                    </div>
                  </th>
                ))}
                <th className="sticky right-0 z-20 w-[118px] max-2xl:w-[108px] px-2 py-2.5 max-2xl:px-1.5 text-right font-medium text-gray-600 bg-gray-50 border-l border-gray-200/80 shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.1)]">
                  {t("components.employeeTable.colActions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <EmployeeTableSkeletonBody showBulkActions={showBulkActions} />
              ) : loadError ? (
                <tr>
                  <td
                    colSpan={showBulkActions ? 12 : 11}
                    className="p-0 align-top"
                  >
                    <DataErrorState
                      message={t("components.dataFetchStates.loadFailed")}
                      retryLabel={t("common.retry")}
                      onRetry={() => void fetchEmployees()}
                    />
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td
                    colSpan={showBulkActions ? 12 : 11}
                    className="p-4 align-top"
                  >
                    {activeFilterCount > 0 ? (
                      <div className="py-12 text-center text-gray-500 text-sm">
                        {t("components.employeeTable.emptyWithFilters")}
                      </div>
                    ) : (
                      <DataEmptyState
                        icon={Users}
                        title={t("employees.emptyFriendly")}
                        className="border-slate-200"
                      >
                        {can("employees:write") ? (
                          <Button asChild>
                            <Link href={ROUTES.employeesNew}>
                              {t("employees.addEmployee")}
                            </Link>
                          </Button>
                        ) : null}
                      </DataEmptyState>
                    )}
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="group border-b last:border-b-0 hover:bg-gray-50 transition-colors"
                  >
                    {showBulkActions && (
                      <td className="sticky left-0 z-20 w-10 px-2 py-2.5 max-2xl:px-2 max-2xl:py-2 bg-white group-hover:bg-gray-50 border-r border-gray-100 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.06)]">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(emp.id)}
                          onChange={() => toggleSelect(emp.id)}
                          className="rounded"
                        />
                      </td>
                    )}
                    <td className="min-w-0 px-2 py-2.5 max-2xl:px-1.5 max-2xl:py-2">
                      <div
                        className="font-medium text-gray-900 truncate flex items-center flex-wrap gap-1"
                        title={`${emp.lastName} ${emp.firstName}`}
                      >
                        <span className="truncate">
                          {emp.lastName} {emp.firstName}
                        </span>
                        {(emp.isMarkedDetached ||
                          (emp.deploymentCount ?? 0) > 0) && (
                          <span
                            className="ml-1 shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800"
                            title={
                              emp.hasActiveDeployment
                                ? "Detasare activa"
                                : "Profil detasare"
                            }
                          >
                            Detasat
                          </span>
                        )}
                      </div>
                      {emp.email && (
                        <div
                          className="text-xs text-gray-400 truncate"
                          title={emp.email}
                        >
                          {emp.email}
                        </div>
                      )}
                    </td>
                    <td className="min-w-0 px-2 py-2.5 max-2xl:px-1.5 max-2xl:py-2 font-mono text-xs text-gray-600 tabular-nums">
                      <span className="block truncate" title={emp.cnp}>
                        {emp.cnp}
                      </span>
                    </td>
                    <td className="min-w-0 px-2 py-2.5 max-2xl:px-1.5 max-2xl:py-2">
                      <div
                        className="flex items-center gap-1 min-w-0 text-gray-600"
                        title={emp.company?.name ?? undefined}
                      >
                        <Building2
                          size={12}
                          className="text-gray-400 shrink-0 max-2xl:hidden"
                        />
                        <span className="truncate text-xs max-2xl:text-[11px] leading-snug">
                          {emp.company?.name ?? t("common.emDash")}
                        </span>
                      </div>
                    </td>
                    <td className="min-w-0 px-2 py-2.5 max-2xl:px-1.5 max-2xl:py-2 text-gray-600">
                      <span
                        className="block truncate text-xs max-2xl:text-[11px]"
                        title={emp.position ?? undefined}
                      >
                        {emp.position ?? t("common.emDash")}
                      </span>
                    </td>
                    <td className="min-w-0 px-2 py-2.5 max-2xl:px-1.5 max-2xl:py-2 text-gray-600">
                      <span
                        className="block truncate text-xs"
                        title={emp.salaryType ?? undefined}
                      >
                        {emp.salaryType ?? t("common.emDash")}
                      </span>
                    </td>
                    <td className="min-w-0 px-2 py-2.5 max-2xl:px-1.5 max-2xl:py-2 text-gray-600 tabular-nums">
                      <span className="block truncate text-xs">
                        {typeof emp.salaryAmount === "number"
                          ? emp.salaryAmount.toLocaleString(numberLocale)
                          : t("common.emDash")}
                      </span>
                    </td>
                    <td className="min-w-0 px-2 py-2.5 max-2xl:px-1.5 max-2xl:py-2 text-gray-600">
                      <span className="block truncate text-xs">
                        {emp.salaryCurrency ?? t("common.emDash")}
                      </span>
                    </td>
                    <td className="min-w-0 px-2 py-2.5 max-2xl:px-1.5 max-2xl:py-2">
                      <StatusBadge status={emp.status} />
                    </td>
                    <td className="min-w-0 px-2 py-2.5 max-2xl:px-1.5 max-2xl:py-2">
                      <div className="flex items-center gap-0.5 text-gray-500 text-xs tabular-nums">
                        <FileText size={12} className="shrink-0" />
                        {emp.documentCount}
                      </div>
                    </td>
                    <td className="min-w-0 px-2 py-2.5 max-2xl:px-1.5 max-2xl:py-2">
                      <div className="flex items-center gap-0.5 text-gray-500 text-xs tabular-nums">
                        <MapPin size={12} className="shrink-0" />
                        {emp.deploymentCount}
                      </div>
                    </td>
                    <td className="sticky right-0 z-10 w-[118px] max-2xl:w-[108px] px-1 py-2.5 max-2xl:py-2 bg-white group-hover:bg-gray-50 border-l border-gray-100 shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.08)]">
                      <div className="flex items-center justify-end gap-0.5 flex-wrap">
                        <Link
                          href={`${ROUTES.employees}/${emp.id}`}
                          className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
                          title={t("components.employeeTable.actionViewTitle")}
                          aria-label={t(
                            "components.employeeTable.actionViewAria",
                          )}
                        >
                          <Eye size={15} />
                        </Link>
                        {can("employees:write") && (
                          <Link
                            href={`${ROUTES.employees}/${emp.id}`}
                            className="p-1 rounded-md text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors shrink-0"
                            title={t(
                              "components.employeeTable.actionEditTitle",
                            )}
                            aria-label={t(
                              "components.employeeTable.actionEditAria",
                            )}
                          >
                            <Pencil size={15} />
                          </Link>
                        )}
                        <PermissionGuard
                          allowedRoles={ROLES_SETTINGS_ADMIN}
                          fallback={null}
                        >
                          <button
                            type="button"
                            onClick={() => handleSoftDelete(emp.id)}
                            className="p-1 rounded-md text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors shrink-0"
                            title={t(
                              "components.employeeTable.actionSoftTerminateTitle",
                            )}
                            aria-label={t(
                              "components.employeeTable.actionSoftTerminateAria",
                            )}
                          >
                            <Trash size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openPermanentDeleteDialog(emp.id)}
                            className="p-1 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors shrink-0"
                            title={t(
                              "components.employeeTable.actionPermanentDeleteTitle",
                            )}
                            aria-label={t(
                              "components.employeeTable.actionPermanentDeleteAria",
                            )}
                          >
                            <Trash2 size={15} />
                          </button>
                        </PermissionGuard>
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
              {t("components.employeeTable.paginationLabel", {
                page,
                totalPages,
                total,
              })}
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

      <AlertDialog
        open={permanentDeleteOpen}
        onOpenChange={(open) => {
          setPermanentDeleteOpen(open);
          if (!open) setEmployeeIdPermanentDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("components.confirm.permanentDeleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <span>{t("components.confirm.permanentDeleteDescription")}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={permanentDeleting} />
            <Button
              type="button"
              variant="destructive"
              disabled={permanentDeleting}
              onClick={() => void handleConfirmPermanentDelete()}
            >
              {permanentDeleting
                ? t("components.confirm.permanentDeleteLoading")
                : t("components.confirm.permanentDeleteButton")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const config: Record<string, { bg: string; text: string; label: string }> = {
    ACTIVE: {
      bg: "bg-green-100",
      text: "text-green-700",
      label: t("components.employeeTable.statusBadgeActive"),
    },
    TERMINATED: {
      bg: "bg-red-100",
      text: "text-red-700",
      label: t("components.employeeTable.statusBadgeTerminated"),
    },
  };
  const c = config[status] ?? {
    bg: "bg-gray-100",
    text: "text-gray-700",
    label: status,
  };

  return (
    <span
      className={`inline-block max-w-full truncate text-xs font-medium px-1.5 py-0.5 max-2xl:px-1.5 rounded-full ${c.bg} ${c.text}`}
      title={c.label}
    >
      {c.label}
    </span>
  );
}
