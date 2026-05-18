"use client";

import { ROLES_EMPLOYEES_RW } from "@/lib/roles";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { useTranslation } from "@/hooks/useTranslation";
import {
  AdvancedFilter,
  type FilterState,
  defaultFilters,
} from "@/components/filters/AdvancedFilter";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { useCanEdit } from "@/hooks/usePermission";
import { downloadWeeklyPayslip } from "@/components/payroll/WeeklyPayslipPDF";
import { formatIsoWeekPeriod, getPayrollWeekDefaults } from "@/lib/isoWeek";
import { preventWheelOnFocusedNumberInput } from "@/lib/numericInput";
import {
  LUNAR_WORKING_DAYS_NORM,
  parseSalaryTypeInput,
  salaryAmountToJson,
  weeklyPaySalaryDataComplete,
} from "@/lib/salaryFields";
import {
  TIMESHEET_PAYROLL_SYNC_CHANNEL,
  type TimesheetPayrollSyncMessage,
} from "@/lib/timesheetPayrollSync";
import {
  defaultWeeklyPayUnitValue,
  getWeeklyPayInputConfig,
  liveWeeklyPayTotal,
} from "@/lib/weeklyPayUi";
import { AlertCircle, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  CompanyOption,
  CountryOption,
  EmployeeWeeklyPayRow,
} from "@/types";

export default function PlataPage() {
  const { t, currentLanguage } = useTranslation();
  const numberLocale = currentLanguage === "ro" ? "ro-RO" : "en-US";
  const canEdit = useCanEdit();
  const [employees, setEmployees] = useState<EmployeeWeeklyPayRow[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<FilterState>({ ...defaultFilters });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [unitsByEmp, setUnitsByEmp] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [payYear, setPayYear] = useState(() => getPayrollWeekDefaults().year);
  const [payWeek, setPayWeek] = useState(() => getPayrollWeekDefaults().week);
  const [companyName, setCompanyName] = useState("Cedol Autocraft SRL");
  const [companyAddress, setCompanyAddress] = useState(
    "Iasi, Str. Pacurari nr. 159a, Jud. Iasi",
  );

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("settings"))))
      .then((data) => {
        if (data.companyName) setCompanyName(String(data.companyName));
        if (data.companyAddress) setCompanyAddress(String(data.companyAddress));
      })
      .catch(() => {
        // keep defaults
      });
  }, []);

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

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "200");
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

  useEffect(() => {
    setUnitsByEmp((prev) => {
      const next = { ...prev };
      for (const emp of employees) {
        if (
          weeklyPaySalaryDataComplete(emp) &&
          next[String(emp.id)] === undefined
        ) {
          next[String(emp.id)] = defaultWeeklyPayUnitValue(emp.salaryType);
        }
      }
      return next;
    });
  }, [employees]);

  const syncHoursFromTimesheet = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/attendance/hours-for-payroll?year=${payYear}&weekNumber=${payWeek}`,
        { cache: "no-store", credentials: "same-origin" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        hoursByEmployeeId?: Record<string, string>;
      };
      const hoursMap = data.hoursByEmployeeId ?? {};
      setUnitsByEmp((prev) => {
        const next = { ...prev };
        for (const emp of employees) {
          if (!weeklyPaySalaryDataComplete(emp)) continue;
          const t = parseSalaryTypeInput(emp.salaryType ?? "");
          const fromPontaj = hoursMap[String(emp.id)];
          if (fromPontaj !== undefined && fromPontaj !== "" && t === "ORA") {
            next[String(emp.id)] = fromPontaj;
          } else if (next[String(emp.id)] === undefined) {
            next[String(emp.id)] = defaultWeeklyPayUnitValue(emp.salaryType);
          }
        }
        return next;
      });
    } catch {
      /* keep manual pay entry if sync fails */
    }
  }, [employees, payYear, payWeek]);

  /** Sync hours from timesheets (Timesheet.hoursWorked) — ORA type. */
  useEffect(() => {
    void syncHoursFromTimesheet();
  }, [syncHoursFromTimesheet]);

  const syncRef = useRef(syncHoursFromTimesheet);
  syncRef.current = syncHoursFromTimesheet;

  /** Other tab → reload hours (BroadcastChannel). */
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(TIMESHEET_PAYROLL_SYNC_CHANNEL);
    ch.onmessage = (ev: MessageEvent<TimesheetPayrollSyncMessage>) => {
      if (ev.data?.type === "hoursUpdated") void syncRef.current();
    };
    return () => ch.close();
  }, []);

  /** Resync ore din pontaj doar la revenirea pe tab (nu la fiecare focus pe input). */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void syncRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const selectableEmployees = employees.filter((e) =>
    weeklyPaySalaryDataComplete(e),
  );

  /** Mirrors Excel export: PDF needs period > 0. */
  function parsedUnitsForExport(
    emp: EmployeeWeeklyPayRow,
    raw: string | undefined,
  ): number {
    const t = parseSalaryTypeInput(emp.salaryType ?? "");
    const s = raw !== undefined ? String(raw).trim() : "";
    if (t === "LUNAR") {
      if (s === "") return LUNAR_WORKING_DAYS_NORM;
      const n = Number(s.replace(",", "."));
      return Number.isFinite(n) && n >= 0 ? n : LUNAR_WORKING_DAYS_NORM;
    }
    const n = Number((raw !== undefined ? String(raw) : "0").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  const pdfExportAllowed =
    selectedIds.size > 0 &&
    Array.from(selectedIds).some((id) => {
      const emp = employees.find((e) => e.id === id);
      if (!emp || !weeklyPaySalaryDataComplete(emp)) return false;
      return parsedUnitsForExport(emp, unitsByEmp[String(id)]) > 0;
    });

  const pdfButtonTitle = useMemo(() => {
    if (selectedIds.size === 0) return t("pages.pay.pdfTitleNoneSelected");
    if (!pdfExportAllowed) return t("pages.pay.pdfTitleNeedPeriod");
    return t("pages.pay.pdfTitleOk");
  }, [pdfExportAllowed, selectedIds.size, t]);

  function toggleSelect(id: number) {
    const emp = employees.find((e) => e.id === id);
    if (!emp || !weeklyPaySalaryDataComplete(emp)) return;
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleSelectAll() {
    const ids = selectableEmployees.map((e) => e.id);
    const allSelected =
      ids.length > 0 && ids.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(ids));
  }

  async function handleExportExcel() {
    if (selectedIds.size === 0) {
      alert(t("pages.pay.alertSelectComplete"));
      return;
    }
    setExporting("excel");
    try {
      const unitsByEmployeeId: Record<string, number> = {};
      for (const id of selectedIds) {
        const emp = employees.find((e) => e.id === id);
        if (!emp) continue;
        const t = parseSalaryTypeInput(emp.salaryType ?? "");
        const raw = unitsByEmp[String(id)];
        const s = raw !== undefined ? String(raw).trim() : "";
        if (t === "LUNAR") {
          if (s === "") unitsByEmployeeId[String(id)] = LUNAR_WORKING_DAYS_NORM;
          else {
            const n = Number(s.replace(",", "."));
            unitsByEmployeeId[String(id)] =
              Number.isFinite(n) && n >= 0 ? n : LUNAR_WORKING_DAYS_NORM;
          }
        } else {
          const n = Number(
            (raw !== undefined ? String(raw) : "0").replace(",", "."),
          );
          unitsByEmployeeId[String(id)] = Number.isFinite(n) && n >= 0 ? n : 0;
        }
      }
      const res = await fetch("/api/export/weekly-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds: Array.from(selectedIds),
          unitsByEmployeeId,
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as {
          error?: string;
          details?: {
            missingIban?: number;
            zeroTotal?: number;
            incompleteSalary?: number;
          };
        };
        const parts: string[] = [];
        const det = d.details;
        if (det?.missingIban)
          parts.push(
            t("pages.pay.toastErrorDetailMissingIban", {
              count: det.missingIban,
            }),
          );
        if (det?.zeroTotal)
          parts.push(
            t("pages.pay.toastErrorDetailZeroTotal", { count: det.zeroTotal }),
          );
        if (det?.incompleteSalary)
          parts.push(
            t("pages.pay.toastErrorDetailIncompleteSalary", {
              count: det.incompleteSalary,
            }),
          );
        const msg = d.error ?? t("pages.pay.toastExportError");
        toast.error(parts.length > 0 ? `${msg}: ${parts.join("; ")}.` : msg);
        return;
      }
      const skippedCount = res.headers.get("X-Export-Skipped-Count");
      const skippedSummary = res.headers.get("X-Export-Skipped-Summary");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bank-pay-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("pages.pay.toastExcelDownloaded"));
      if (
        skippedCount &&
        Number.parseInt(skippedCount, 10) > 0 &&
        skippedSummary
      ) {
        toast.warning(skippedSummary, { duration: 10000 });
      }
    } catch {
      toast.error(t("pages.pay.toastExportError"));
    } finally {
      setExporting(null);
    }
  }

  async function handleExportPdf() {
    if (selectedIds.size === 0) {
      alert(t("pages.pay.alertSelectComplete"));
      return;
    }
    if (!pdfExportAllowed) return;
    setExporting("pdf");
    try {
      const period = formatIsoWeekPeriod(payYear, payWeek);
      for (const id of selectedIds) {
        const emp = employees.find((e) => e.id === id);
        if (!emp || !weeklyPaySalaryDataComplete(emp)) continue;
        const units = parsedUnitsForExport(emp, unitsByEmp[String(id)]);
        if (units <= 0) continue;
        const netSalary = liveWeeklyPayTotal(
          emp.salaryType,
          unitsByEmp[String(id)],
          emp.salaryAmount,
        );
        if (netSalary == null) continue;
        const hoursWorked =
          parseSalaryTypeInput(emp.salaryType ?? "") === "ORA" ? units : 0;
        const hourlyRate =
          hoursWorked > 0 ? netSalary / hoursWorked : Number(emp.salaryAmount ?? 0);
        const employeeName =
          `${String(emp.lastName ?? "").trim()} ${String(emp.firstName ?? "").trim()}`.trim() ||
          "—";
        downloadWeeklyPayslip({
          companyName,
          companyAddress,
          employeeName,
          employeeId: String(emp.id),
          position: "—",
          weekNumber: payWeek,
          year: payYear,
          periodStart: period.start,
          periodEnd: period.end,
          hoursWorked,
          hourlyRate,
          salaryForHours: netSalary,
          netSalary,
          travelAllowance: 0,
          totalPaid: netSalary,
          holidayMoney: 0,
        });
      }
    } catch {
      alert(t("pages.pay.alertPdfExportFailed"));
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("pages.pay.title")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t("pages.pay.subtitle")}</p>
      </div>

      <div className="rounded-xl border border-violet-100 bg-violet-50/90 px-4 py-3 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600">
            {t("pages.pay.payYearLabel")}
          </label>
          <input
            type="number"
            min={2020}
            max={2040}
            className="mt-1 w-28 rounded-lg border border-violet-200 bg-white px-2 py-1.5 text-sm tabular-nums"
            onWheel={preventWheelOnFocusedNumberInput}
            value={payYear}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (e.target.value !== "" && Number.isFinite(n)) setPayYear(n);
            }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">
            {t("pages.pay.payWeekLabel")}
          </label>
          <input
            type="number"
            min={1}
            max={53}
            className="mt-1 w-24 rounded-lg border border-violet-200 bg-white px-2 py-1.5 text-sm tabular-nums"
            onWheel={preventWheelOnFocusedNumberInput}
            value={payWeek}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (e.target.value !== "" && Number.isFinite(n)) setPayWeek(n);
            }}
          />
        </div>
        <p className="text-xs text-gray-700 flex-1 min-w-[14rem] leading-snug">
          {t("pages.pay.hoursSyncHint", {
            ora: t("pages.pay.oraLabel"),
            timesheet: t("pages.pay.timesheetModel"),
            pay: t("pages.pay.title"),
            timesheets: t("nav.timesheets"),
          })}
        </p>
      </div>

      <AdvancedFilter
        filters={filters}
        onChange={setFilters}
        onApply={fetchEmployees}
        onReset={() => setFilters({ ...defaultFilters })}
        companies={companies}
        countries={countries}
      />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-700">
            {loading
              ? t("pages.pay.tableLoading")
              : t("pages.pay.employeesShown", { count: employees.length })}
          </span>
          <span className="text-xs text-gray-500">
            {total > employees.length
              ? t("pages.pay.totalMatching", { total })
              : null}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-3 py-3 w-10 text-left">
                  <input
                    type="checkbox"
                    disabled={selectableEmployees.length === 0}
                    checked={
                      selectableEmployees.length > 0 &&
                      selectableEmployees.every((e) => selectedIds.has(e.id))
                    }
                    onChange={toggleSelectAll}
                    className="rounded"
                    title={t("pages.pay.selectCompleteCheckboxTitle")}
                  />
                </th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">
                  {t("pages.pay.colName")}
                </th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">
                  {t("pages.pay.colCnp")}
                </th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">
                  {t("pages.pay.colPayType")}
                </th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">
                  {t("pages.pay.colGross")}
                </th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">
                  {t("pages.pay.colCurrency")}
                </th>
                <th className="px-3 py-3 text-left font-medium text-gray-600 min-w-[10rem]">
                  {t("pages.pay.colWorkedPeriod")}
                </th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">
                  {t("pages.pay.colCalculatedTotal")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    <Loader2 className="inline animate-spin mr-2" size={18} />
                    {t("pages.pay.tableLoading")}
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    <AlertCircle className="inline mr-2" size={18} />
                    {t("pages.pay.emptyTable")}
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const complete = weeklyPaySalaryDataComplete(emp);
                  const cfg = getWeeklyPayInputConfig(emp.salaryType);
                  const raw =
                    unitsByEmp[String(emp.id)] !== undefined
                      ? unitsByEmp[String(emp.id)]
                      : defaultWeeklyPayUnitValue(emp.salaryType);
                  const amt = salaryAmountToJson(emp.salaryAmount);
                  const totalCalc = complete
                    ? liveWeeklyPayTotal(emp.salaryType, raw, emp.salaryAmount)
                    : null;

                  return (
                    <tr
                      key={emp.id}
                      className={
                        complete
                          ? selectedIds.has(emp.id)
                            ? "bg-violet-50/80 border-b"
                            : "border-b hover:bg-gray-50"
                          : "border-b bg-gray-100 text-gray-500"
                      }
                    >
                      <td className="px-3 py-3 align-top">
                        <input
                          type="checkbox"
                          disabled={!complete}
                          checked={selectedIds.has(emp.id)}
                          onChange={() => toggleSelect(emp.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-3 font-medium text-gray-900">
                        {emp.lastName} {emp.firstName}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{emp.cnp}</td>
                      <td className="px-3 py-3">
                        {complete ? (emp.salaryType ?? t("common.emDash")) : t("common.emDash")}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {complete && amt != null
                          ? amt.toLocaleString(numberLocale, {
                              maximumFractionDigits: 2,
                            })
                          : "—"}
                      </td>
                      <td className="px-3 py-3">
                        {complete ? (emp.salaryCurrency ?? t("common.emDash")) : t("common.emDash")}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {complete ? (
                          <div className="space-y-1 max-w-[14rem]">
                            <label className="block text-[11px] font-medium text-gray-600">
                              {cfg.label}
                            </label>
                            <ReadOnlyField
                              type="text"
                              inputMode="decimal"
                              min={cfg.min}
                              placeholder={cfg.placeholder || undefined}
                              value={raw}
                              onChange={(e) =>
                                setUnitsByEmp((p) => ({
                                  ...p,
                                  [String(emp.id)]: e.target.value,
                                }))
                              }
                              readOnly={!canEdit}
                              readOnlyTooltip={t("pages.pay.readOnlyNoEdit")}
                              className={
                                !canEdit
                                  ? "focus:ring-0"
                                  : "focus:ring-violet-500"
                              }
                            />
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-gray-500">
                            {t("pages.pay.incompleteSalary")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium">
                        {complete && totalCalc != null && emp.salaryCurrency ? (
                          <>
                            {totalCalc.toLocaleString(numberLocale, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            })}{" "}
                            <span className="text-gray-500 font-normal">
                              {emp.salaryCurrency}
                            </span>
                          </>
                        ) : (
                          t("common.emDash")
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-4 border-t bg-gray-50 space-y-2">
          <p className="text-xs text-gray-600 max-w-3xl">
            <strong>{t("pages.pay.exportExcelHelpStrong")}</strong>{" "}
            {t("pages.pay.exportExcelHelpBody")}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <PermissionGuard allowedRoles={ROLES_EMPLOYEES_RW}>
              <button
                type="button"
                onClick={() => void handleExportExcel()}
                disabled={exporting !== null || selectedIds.size === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {exporting === "excel" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileSpreadsheet size={16} />
                )}
                {t("pages.pay.exportExcelPay")}
              </button>
            </PermissionGuard>
            <PermissionGuard allowedRoles={ROLES_EMPLOYEES_RW}>
              <button
                type="button"
                onClick={() => void handleExportPdf()}
                disabled={exporting !== null || !pdfExportAllowed}
                title={pdfButtonTitle}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-violet-300 bg-white text-violet-800 text-sm font-medium hover:bg-violet-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {exporting === "pdf" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileText size={16} />
                )}
                {t("pages.pay.exportPdfPay")}
              </button>
            </PermissionGuard>
          </div>
        </div>
      </div>
    </div>
  );
}
