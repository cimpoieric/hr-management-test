"use client";

import {
  AdvancedFilter,
  type FilterState,
  defaultFilters,
} from "@/components/filters/AdvancedFilter";
import { BulkSelectionBar } from "@/components/tables/BulkSelection";
import { useTranslation } from "@/hooks/useTranslation";
import type { ExportColumnCategory, ExportColumnOption } from "@/types";
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Columns3,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  Users,
} from "lucide-react";
import type { TFunction } from "i18next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ROUTES } from "@/lib/routes";
import type {
  CompanyOption,
  CountryOption,
  EmployeeListApiRow,
} from "@/types";

const COLUMN_DEFS: {
  key: string;
  category: ExportColumnCategory;
}[] = [
  { key: "id", category: "meta" },
  { key: "lastName", category: "personal" },
  { key: "firstName", category: "personal" },
  { key: "cnp", category: "personal" },
  { key: "seriesCI", category: "personal" },
  { key: "numberCI", category: "personal" },
  { key: "email", category: "personal" },
  { key: "phone", category: "personal" },
  { key: "position", category: "professional" },
  { key: "status", category: "professional" },
  { key: "company", category: "professional" },
  { key: "address", category: "personal" },
  { key: "city", category: "personal" },
  { key: "country", category: "personal" },
  { key: "hiredAt", category: "professional" },
  { key: "iban", category: "financial" },
  { key: "bankName", category: "financial" },
  { key: "salaryType", category: "financial" },
  { key: "salaryAmount", category: "financial" },
  { key: "salaryCurrency", category: "financial" },
  { key: "salaryStartDate", category: "financial" },
  { key: "observations", category: "meta" },
];

const CATEGORY_ORDER: ExportColumnCategory[] = [
  "personal",
  "professional",
  "financial",
  "meta",
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function ExportPage() {
  const router = useRouter();
  const { t, currentLanguage } = useTranslation();
  const dateLocale = currentLanguage === "ro" ? "ro-RO" : "en-US";

  const columnOptions = useMemo((): ExportColumnOption[] => {
    return COLUMN_DEFS.map((d) => ({
      ...d,
      label: t(`pages.export.columns.${d.key}`),
    }));
  }, [t]);

  // ── State ──
  const [employees, setEmployees] = useState<EmployeeListApiRow[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState<FilterState>({ ...defaultFilters });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set([
      "id",
      "lastName",
      "firstName",
      "cnp",
      "email",
      "phone",
      "status",
      "position",
      "company",
    ]),
  );
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [salaryExporting, setSalaryExporting] = useState<"csv" | "xlsx" | null>(
    null,
  );
  const [salaryTypeFilter, setSalaryTypeFilter] = useState("");
  const [salaryCurrencyFilter, setSalaryCurrencyFilter] = useState("");
  const [salaryCompleteOnly, setSalaryCompleteOnly] = useState(false);
  const [step, setStep] = useState<"select" | "configure" | "preview">(
    "select",
  );

  // ── Fetch companies + countries ──
  useEffect(() => {
    fetch("/api/organization/companies")
      .then((r) => r.json())
      .then((data) => setCompanies(data.companies ?? []))
      .catch(() => setCompanies([]));
    fetch("/api/organization/countries")
      .then((r) => r.json())
      .then((data) => setCountries(data.countries ?? []))
      .catch(() => setCountries([]));
  }, []);

  // ── Fetch employees with filters ──
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "200"); // max for selection
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
      if (filters.hireDateFrom)
        params.set("hireDateFrom", filters.hireDateFrom);
      if (filters.hireDateTo) params.set("hireDateTo", filters.hireDateTo);
      if (filters.hasAssignment) params.set("hasAssignment", "true");

      const res = await fetch(`/api/employees?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setEmployees(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setEmployees([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // ── Selection helpers ──
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

  // ── Column helpers ──
  function toggleColumn(key: string) {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllColumns() {
    setSelectedColumns(new Set(columnOptions.map((c) => c.key)));
  }

  function clearAllColumns() {
    setSelectedColumns(new Set());
  }

  // ── Export ──
  async function handleExport(type: "excel" | "pdf") {
    if (selectedIds.size === 0) {
      alert(t("pages.export.alertMinEmployee"));
      return;
    }
    if (selectedColumns.size === 0 && type === "excel") {
      alert(t("pages.export.alertMinColumn"));
      return;
    }

    setExporting(type);
    try {
      const endpoint =
        type === "excel" ? "/api/export/excel" : "/api/export/pdf";
      const body: Record<string, unknown> = {
        employeeIds: Array.from(selectedIds),
      };
      if (type === "excel") {
        body.columns = Array.from(selectedColumns);
      } else {
        body.type = "detailed";
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const d = await res.json();
        alert((d.error as string) ?? t("pages.export.alertExportFailed"));
        setExporting(null);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `employees-export-${new Date().toISOString().slice(0, 10)}.${type === "excel" ? "xlsx" : "pdf"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert(t("pages.export.alertExportFailed"));
    } finally {
      setExporting(null);
    }
  }

  async function handleSalarySheetExport(format: "csv" | "xlsx") {
    setSalaryExporting(format);
    try {
      const res = await fetch("/api/export/salary-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          salaryType: salaryTypeFilter || null,
          salaryCurrency: salaryCurrencyFilter || null,
          salaryCompleteOnly,
          ...(selectedIds.size > 0
            ? { employeeIds: Array.from(selectedIds) }
            : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert((d.error as string) ?? t("pages.export.alertSalaryExportFailed"));
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "csv" ? "csv" : "xlsx";
      a.download =
        format === "csv"
          ? `payroll-accounting-${new Date().toISOString().slice(0, 10)}.csv`
          : `bank-payment-sheet-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert(t("pages.export.alertSalaryExportFailed"));
    } finally {
      setSalaryExporting(null);
    }
  }

  // ── Preview data ──
  const selectedEmployees = employees.filter((e) => selectedIds.has(e.id));
  const previewEmployees = selectedEmployees.slice(0, 5);
  const previewColumns = columnOptions.filter((c) =>
    selectedColumns.has(c.key),
  );

  // ── Render ──

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Download size={24} className="text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("pages.export.title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("pages.export.intro")}{" "}
            {t("pages.export.weeklyPayHintBefore")}{" "}
            <Link
              href={ROUTES.pay}
              className="text-violet-600 hover:underline font-medium"
            >
              {t("nav.pay")}
            </Link>
            {t("pages.export.weeklyPayHintAfter")}
          </p>
        </div>
      </div>

      <AdvancedFilter
        filters={filters}
        onChange={setFilters}
        onApply={fetchEmployees}
        onReset={() => setFilters({ ...defaultFilters })}
        companies={companies}
        countries={countries}
      />

      {/* Section: accounting + custom export (steps 1–3) */}
      <section className="rounded-2xl border-2 border-slate-200 bg-slate-50/50 p-6 md:p-8 space-y-8 shadow-sm">
        {/* Salary / accounting export */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">
            {t("pages.export.sectionAccountingTitle")}
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            {t("pages.export.sectionAccountingBody")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <select
              value={salaryTypeFilter}
              onChange={(e) => setSalaryTypeFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">{t("pages.export.allPayTypes")}</option>
              <option value="LUNAR">LUNAR</option>
              <option value="SAPTAMANAL">SAPTAMANAL</option>
              <option value="ORA">ORA</option>
            </select>
            <select
              value={salaryCurrencyFilter}
              onChange={(e) => setSalaryCurrencyFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">{t("pages.export.allCurrencies")}</option>
              <option value="RON">RON</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
            <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={salaryCompleteOnly}
                onChange={(e) => setSalaryCompleteOnly(e.target.checked)}
                className="rounded"
              />
              {t("pages.export.salaryCompleteOnly")}
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleSalarySheetExport("csv")}
                disabled={salaryExporting !== null}
                className="inline-flex flex-1 min-w-[8rem] items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-40"
              >
                {salaryExporting === "csv" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileText size={16} />
                )}
                {t("pages.export.exportAccountingCsv")}
              </button>
              <button
                type="button"
                onClick={() => handleSalarySheetExport("xlsx")}
                disabled={salaryExporting !== null}
                className="inline-flex flex-1 min-w-[8rem] items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                {salaryExporting === "xlsx" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileSpreadsheet size={16} />
                )}
                {t("pages.export.paymentSheetExcel")}
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            <span className="font-medium text-gray-700">
              {t("pages.export.csvLegendLabel")}
            </span>{" "}
            {t("pages.export.csvLegendBody")}{" "}
            <span className="font-medium text-gray-700">
              {t("pages.export.excelPaymentLegendLabel")}
            </span>{" "}
            {t("pages.export.excelPaymentLegendBody")}
          </p>
          <p className="mt-2 text-xs text-amber-700">
            {t("pages.export.gdprFooter")}
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900">
            {t("pages.export.customTitle")}
          </h2>
          <p className="text-xs text-gray-500 mt-1 mb-4">
            {t("pages.export.customSubtitle")}
          </p>

          {/* Step indicator */}
          <div className="flex items-center gap-2 text-sm">
            {[
              {
                key: "select" as const,
                label: t("pages.export.step1"),
                icon: Users,
              },
              {
                key: "configure" as const,
                label: t("pages.export.step2"),
                icon: Columns3,
              },
              {
                key: "preview" as const,
                label: t("pages.export.step3"),
                icon: Eye,
              },
            ].map((s, idx) => (
              <button
                key={s.key}
                onClick={() => setStep(s.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition-colors ${
                  step === s.key
                    ? "bg-slate-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <s.icon size={14} />
                {s.label}
                {idx < 2 && (
                  <ChevronRight size={14} className="ml-1 opacity-50" />
                )}
              </button>
            ))}
          </div>

          {/* ── STEP 1: Select employees ── */}
          {step === "select" && (
            <div className="space-y-4">
              {selectedIds.size > 0 && (
                <BulkSelectionBar
                  selectedIds={Array.from(selectedIds)}
                  totalResults={total}
                  onClear={clearSelection}
                  onSelectAllResults={selectAllResults}
                />
              )}

              {/* Employee selection table */}
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
                  <span className="text-sm font-medium text-gray-700">
                    {loading
                      ? t("pages.export.tableLoading")
                      : t("pages.export.employeesFound", {
                          count: employees.length,
                        })}
                  </span>
                  {selectedIds.size > 0 && (
                    <span className="text-sm text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                      {t("pages.export.selectedCountShort", {
                        count: selectedIds.size,
                      })}
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
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
                        <th className="px-4 py-3 text-left font-medium text-gray-600">
                          {t("pages.export.colLastName")}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">
                          {t("pages.export.colCnp")}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">
                          {t("pages.export.colPayType")}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">
                          {t("pages.export.colPosition")}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">
                          {t("pages.export.colStatus")}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">
                          {t("pages.export.colCompany")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-12 text-center text-gray-400"
                          >
                            <Loader2
                              size={20}
                              className="inline animate-spin mr-2"
                            />
                            {t("pages.export.tableLoading")}
                          </td>
                        </tr>
                      ) : employees.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-12 text-center text-gray-400"
                          >
                            <AlertCircle size={20} className="inline mr-2" />
                            {t("pages.export.emptyTable")}
                          </td>
                        </tr>
                      ) : (
                        employees.map((emp) => {
                          const rowHighlight = selectedIds.has(emp.id)
                            ? "bg-blue-50"
                            : "hover:bg-gray-50";
                          return (
                            <tr
                              key={emp.id}
                              className={`border-b last:border-b-0 transition-colors cursor-pointer ${rowHighlight}`}
                              onClick={() => toggleSelect(emp.id)}
                            >
                              <td
                                className="px-4 py-3"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(emp.id)}
                                  onChange={() => toggleSelect(emp.id)}
                                  className="rounded"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">
                                  {emp.lastName} {emp.firstName}
                                </div>
                                {emp.email && (
                                  <div className="text-xs text-gray-400">
                                    {emp.email}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono text-gray-600">
                                {emp.cnp}
                              </td>
                              <td className="px-4 py-3 text-gray-700">
                                {emp.salaryType ?? t("common.emDash")}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {emp.position ?? t("common.emDash")}
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={emp.status} />
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {emp.company?.name ?? t("common.emDash")}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="px-4 py-3 border-t flex flex-wrap items-center justify-end gap-2 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => setStep("configure")}
                    disabled={selectedIds.size === 0}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {t("pages.export.continueWithSelected", {
                      count: selectedIds.size,
                    })}
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Configure columns ── */}
          {step === "configure" && (
            <div className="space-y-4">
              {/* Back + summary */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep("select")}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft size={14} />
                  {t("pages.export.backToSelection")}
                </button>
                <span className="text-sm text-gray-500">
                  {t("pages.export.selectedEmployeesLine", {
                    count: selectedIds.size,
                  })}
                </span>
              </div>

              {/* Column selector */}
              <div className="bg-white rounded-xl border shadow-sm">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Columns3 size={16} className="text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      {t("pages.export.columnsForExport")}
                    </span>
                    <span className="text-xs bg-slate-900 text-white px-2 py-0.5 rounded-full">
                      {selectedColumns.size}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAllColumns}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      {t("pages.export.selectAllColumns")}
                    </button>
                    <button
                      onClick={clearAllColumns}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      {t("pages.export.deselectAllColumns")}
                    </button>
                  </div>
                </div>

                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {CATEGORY_ORDER.map((cat) => (
                    <div key={cat}>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        {t(`pages.export.categories.${cat}`)}
                      </h4>
                      <div className="space-y-1.5">
                        {columnOptions
                          .filter((c) => c.category === cat)
                          .map((col) => (
                            <label
                              key={col.key}
                              className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-gray-50"
                            >
                              <input
                                type="checkbox"
                                checked={selectedColumns.has(col.key)}
                                onChange={() => toggleColumn(col.key)}
                                className="rounded"
                              />
                              <span className="text-sm text-gray-700">
                                {col.label}
                              </span>
                            </label>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-4 py-3 border-t flex items-center justify-end gap-2 bg-gray-50">
                  <button
                    onClick={() => setStep("preview")}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
                  >
                    <Eye size={14} />
                    {t("pages.export.previewAndExportCta")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Preview & Export ── */}
          {step === "preview" && (
            <div className="space-y-4">
              {/* Back + summary */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep("configure")}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft size={14} />
                  {t("pages.export.backToColumns")}
                </button>
                <span className="text-sm text-gray-500">
                  {t("pages.export.summaryRowsCols", {
                    employees: selectedIds.size,
                    columns: selectedColumns.size,
                  })}
                </span>
              </div>

              {/* Preview table */}
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center gap-2 bg-gray-50">
                  <Eye size={16} className="text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {t("pages.export.previewHeading", {
                      total: selectedEmployees.length,
                    })}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        {previewColumns.map((col) => (
                          <th
                            key={col.key}
                            className="px-3 py-2 text-left font-medium text-gray-600 text-xs uppercase tracking-wider"
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewEmployees.map((emp) => (
                        <tr
                          key={emp.id}
                          className="border-b last:border-b-0 hover:bg-gray-50"
                        >
                          {previewColumns.map((col) => (
                            <td
                              key={col.key}
                              className="px-3 py-2 text-gray-700 whitespace-nowrap"
                            >
                              {getPreviewValue(emp, col.key, t, dateLocale)}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {selectedEmployees.length === 0 && (
                        <tr>
                          <td
                            colSpan={previewColumns.length || 1}
                            className="px-4 py-8 text-center text-gray-400"
                          >
                            {t("pages.export.noSelectionPreview")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {selectedEmployees.length > 5 && (
                  <div className="px-4 py-2 border-t text-xs text-gray-500 bg-gray-50 text-center">
                    {t("pages.export.moreSelectedRows", {
                      count: selectedEmployees.length - 5,
                    })}
                  </div>
                )}
              </div>

              {/* Export buttons */}
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <h3 className="text-sm font-medium text-gray-700 mb-4">
                  {t("pages.export.exportFinal")}
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleExport("excel")}
                    disabled={exporting !== null || selectedIds.size === 0}
                    className="flex items-center gap-2 px-5 py-3 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {exporting === "excel" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <FileSpreadsheet size={16} />
                    )}
                    {t("pages.export.exportExcelFile")}
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                      {selectedIds.size}
                    </span>
                  </button>

                  <button
                    onClick={() => handleExport("pdf")}
                    disabled={exporting !== null || selectedIds.size === 0}
                    className="flex items-center gap-2 px-5 py-3 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {exporting === "pdf" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <FileText size={16} />
                    )}
                    {t("pages.export.exportPdf")}
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                      {selectedIds.size}
                    </span>
                  </button>

                  <button
                    onClick={() => router.push(ROUTES.employees)}
                    className="flex items-center gap-2 px-5 py-3 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {t("common.cancel")}
                  </button>
                </div>

                {/* Warning for sensitive data */}
                {selectedColumns.has("cnp") || selectedColumns.has("iban") ? (
                  <div className="mt-4 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-3">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <p>{t("pages.export.gdprSensitiveBox")}</p>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
      className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  );
}

function getPreviewValue(
  emp: EmployeeListApiRow,
  key: string,
  t: TFunction<"translation">,
  dateLocale: string,
): string {
  const dash = t("common.emDash");
  switch (key) {
    case "id":
      return String(emp.id);
    case "lastName":
      return emp.lastName;
    case "firstName":
      return emp.firstName;
    case "cnp":
      return emp.cnp;
    case "seriesCI":
      return emp.seriesCI ?? dash;
    case "numberCI":
      return emp.numberCI ?? dash;
    case "email":
      return emp.email ?? dash;
    case "phone":
      return emp.phone ?? dash;
    case "position":
      return emp.position ?? dash;
    case "status":
      return emp.status === "ACTIVE"
        ? t("components.employeeTable.statusBadgeActive")
        : t("components.employeeTable.statusBadgeTerminated");
    case "company":
      return emp.company?.name ?? dash;
    case "address":
      return emp.address ?? dash;
    case "city":
      return emp.city ?? dash;
    case "country":
      return emp.country
        ? `${emp.country.name} (${emp.country.code})`
        : dash;
    case "hiredAt":
      return emp.hiredAt
        ? new Date(emp.hiredAt).toLocaleDateString(dateLocale)
        : dash;
    case "iban":
      return emp.iban ?? dash;
    case "bankName":
      return emp.bankName ?? dash;
    case "salaryType":
      return emp.salaryType ?? dash;
    case "salaryAmount":
      return typeof emp.salaryAmount === "number"
        ? String(emp.salaryAmount)
        : dash;
    case "salaryCurrency":
      return emp.salaryCurrency ?? dash;
    case "salaryStartDate":
      return emp.salaryStartDate
        ? new Date(emp.salaryStartDate).toLocaleDateString(dateLocale)
        : dash;
    case "observations":
      return emp.observations ?? dash;
    default:
      return dash;
  }
}
