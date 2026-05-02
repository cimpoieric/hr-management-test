"use client";

import { useState, useCallback, useEffect } from "react";
import { Loader2, FileSpreadsheet, FileText, AlertCircle } from "lucide-react";
import { AdvancedFilter, defaultFilters, type FilterState } from "@/components/filters/AdvancedFilter";
import {
  weeklyPaySalaryDataComplete,
  parseSalaryTypeInput,
  salaryAmountToJson,
  LUNAR_WORKING_DAYS_NORM,
} from "@/lib/salaryFields";
import {
  defaultWeeklyPayUnitValue,
  getWeeklyPayInputConfig,
  liveWeeklyPayTotal,
} from "@/lib/weeklyPayUi";

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  cnp: string;
  salaryType?: string | null;
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

export default function PlataPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [countries, setCountries] = useState<CountryOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<FilterState>({ ...defaultFilters });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [unitsByEmp, setUnitsByEmp] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => setCompanies(data.companies ?? []))
      .catch(() => setCompanies([]));
    fetch("/api/countries")
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

      const res = await fetch(`/api/employees?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Eroare fetch");
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
        if (weeklyPaySalaryDataComplete(emp) && next[String(emp.id)] === undefined) {
          next[String(emp.id)] = defaultWeeklyPayUnitValue(emp.salaryType);
        }
      }
      return next;
    });
  }, [employees]);

  const selectableEmployees = employees.filter((e) => weeklyPaySalaryDataComplete(e));

  /** Aceeași logică ca la export Excel — pentru activarea butonului PDF (perioadă > 0). */
  function parsedUnitsForExport(emp: Employee, raw: string | undefined): number {
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

  const pdfButtonTitle =
    selectedIds.size === 0
      ? "Selectează cel puțin un angajat cu date salariale complete"
      : !pdfExportAllowed
        ? "Completează perioada lucrată pentru cel puțin un angajat"
        : "Descarcă fișa PDF";

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
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(ids));
  }

  async function handleExportExcel() {
    if (selectedIds.size === 0) {
      alert("Selectează cel puțin un angajat cu date salariale complete.");
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
          const n = Number((raw !== undefined ? String(raw) : "0").replace(",", "."));
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
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Eroare la export");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `plata-angajati-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Eroare la export");
    } finally {
      setExporting(null);
    }
  }

  async function handleExportPdf() {
    if (selectedIds.size === 0) {
      alert("Selectează cel puțin un angajat cu date salariale complete.");
      return;
    }
    if (!pdfExportAllowed) return;
    setExporting("pdf");
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
          const n = Number((raw !== undefined ? String(raw) : "0").replace(",", "."));
          unitsByEmployeeId[String(id)] = Number.isFinite(n) && n >= 0 ? n : 0;
        }
      }
      const res = await fetch("/api/export/weekly-pay-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds: Array.from(selectedIds),
          unitsByEmployeeId,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Eroare la export PDF");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fisa-plata-saptamanala-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Eroare la export PDF");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Plată</h1>
        <p className="text-sm text-gray-500 mt-1">
          Aceleași date salariale ca în lista Angajați. Completează perioada și exportă Excel pentru contabilitate.
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
            {loading ? "Se încarcă..." : `${employees.length} angajați afișați`}
          </span>
          <span className="text-xs text-gray-500">
            {total > employees.length ? `Total în sistem după filtre: ${total}` : null}
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
                    title="Selectează doar angajații cu date salariale complete"
                  />
                </th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Nume</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">CNP</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Tip plată</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">Sumă brută</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Monedă</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600 min-w-[10rem]">
                  Perioada lucrată
                </th>
                <th className="px-3 py-3 text-right font-medium text-gray-600">Total calculat</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    <Loader2 className="inline animate-spin mr-2" size={18} />
                    Se încarcă...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    <AlertCircle className="inline mr-2" size={18} />
                    Niciun angajat. Ajustează filtrele.
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
                      <td className="px-3 py-3">{complete ? emp.salaryType ?? "—" : "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {complete && amt != null
                          ? amt.toLocaleString("ro-RO", { maximumFractionDigits: 2 })
                          : "—"}
                      </td>
                      <td className="px-3 py-3">{complete ? emp.salaryCurrency ?? "—" : "—"}</td>
                      <td className="px-3 py-3 align-top">
                        {complete ? (
                          <div className="space-y-1 max-w-[14rem]">
                            <label className="block text-[11px] font-medium text-gray-600">
                              {cfg.label}
                            </label>
                            <input
                              type="number"
                              min={cfg.min}
                              step={cfg.step}
                              placeholder={cfg.placeholder || undefined}
                              value={raw}
                              onChange={(e) =>
                                setUnitsByEmp((p) => ({
                                  ...p,
                                  [String(emp.id)]: e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-gray-500">
                            Lipsesc date salariale
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium">
                        {complete && totalCalc != null && emp.salaryCurrency ? (
                          <>
                            {totalCalc.toLocaleString("ro-RO", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            })}{" "}
                            <span className="text-gray-500 font-normal">{emp.salaryCurrency}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-4 border-t bg-gray-50 flex flex-wrap items-center justify-end gap-3">
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
            Export Excel plată
          </button>
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
            Export PDF plată
          </button>
        </div>
      </div>
    </div>
  );
}
