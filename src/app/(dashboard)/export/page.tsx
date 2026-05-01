"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  FileText,
  Loader2,
  Download,
  Eye,
  Columns3,
  Users,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  CalendarDays,
} from "lucide-react";
import { AdvancedFilter, defaultFilters, type FilterState } from "@/components/filters/AdvancedFilter";
import { BulkSelectionBar } from "@/components/tables/BulkSelection";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  country: string | null;
  company: { id: number; name: string } | null;
  documentCount: number;
  deploymentCount: number;
  createdAt: string;
  hiredAt: string | null;
  iban?: string | null;
  bankName?: string | null;
  observations?: string | null;
  salaryType?: string | null;
  salaryAmount?: number | null;
  salaryCurrency?: string | null;
  salaryStartDate?: string | null;
}

interface Company {
  id: number;
  name: string;
}

interface ColumnOption {
  key: string;
  label: string;
  category: "personal" | "professional" | "financial" | "meta";
}

// ─── Column options ──────────────────────────────────────────────────────────

const COLUMN_OPTIONS: ColumnOption[] = [
  { key: "id", label: "ID", category: "meta" },
  { key: "lastName", label: "Nume", category: "personal" },
  { key: "firstName", label: "Prenume", category: "personal" },
  { key: "cnp", label: "CNP", category: "personal" },
  { key: "seriesCI", label: "Serie CI", category: "personal" },
  { key: "numberCI", label: "Număr CI", category: "personal" },
  { key: "email", label: "Email", category: "personal" },
  { key: "phone", label: "Telefon", category: "personal" },
  { key: "position", label: "Funcție", category: "professional" },
  { key: "status", label: "Status", category: "professional" },
  { key: "company", label: "Firmă", category: "professional" },
  { key: "address", label: "Adresă", category: "personal" },
  { key: "city", label: "Oraș", category: "personal" },
  { key: "country", label: "Țară", category: "personal" },
  { key: "hiredAt", label: "Data angajării", category: "professional" },
  { key: "iban", label: "IBAN", category: "financial" },
  { key: "bankName", label: "Bancă", category: "financial" },
  { key: "salaryType", label: "Tip plată", category: "financial" },
  { key: "salaryAmount", label: "Sumă brută", category: "financial" },
  { key: "salaryCurrency", label: "Monedă", category: "financial" },
  { key: "salaryStartDate", label: "Valabil de la", category: "financial" },
  { key: "observations", label: "Observații", category: "meta" },
];

const CATEGORY_LABELS: Record<string, string> = {
  personal: "Date personale",
  professional: "Date profesionale",
  financial: "Date financiare",
  meta: "Altele",
};

/** Pentru export „Plată săptămânală”: ORA + sumă orară + monedă */
function weeklySalaryComplete(
  emp: Pick<Employee, "salaryType" | "salaryAmount" | "salaryCurrency">
): boolean {
  return (
    emp.salaryType === "ORA" &&
    emp.salaryAmount != null &&
    Number(emp.salaryAmount) > 0 &&
    !!(emp.salaryCurrency?.trim())
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ExportPage() {
  const router = useRouter();

  // ── State ──
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState<FilterState>({ ...defaultFilters });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(["id", "lastName", "firstName", "cnp", "email", "phone", "status", "position", "company"])
  );
  const [showPreview, setShowPreview] = useState(false);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [salaryExporting, setSalaryExporting] = useState<"csv" | "xlsx" | null>(null);
  const [salaryTypeFilter, setSalaryTypeFilter] = useState("");
  const [salaryCurrencyFilter, setSalaryCurrencyFilter] = useState("");
  const [salaryCompleteOnly, setSalaryCompleteOnly] = useState(false);
  const [weeklyHours, setWeeklyHours] = useState<Record<string, string>>({});
  const [weeklyPayExporting, setWeeklyPayExporting] = useState(false);
  const [step, setStep] = useState<"select" | "configure" | "preview">("select");

  // ── Fetch companies ──
  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => setCompanies(Array.isArray(data) ? data : data.data ?? []))
      .catch(() => setCompanies([]));
  }, []);

  // ── Fetch employees with filters ──
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "200"); // max pentru selectie
      if (filters.search) params.set("search", filters.search);
      if (filters.status.length > 0) params.set("status", filters.status.join(","));
      if (filters.company.length > 0) params.set("company", filters.company.join(","));
      if (filters.country.length > 0) params.set("country", filters.country.join(","));
      if (filters.expiredDocumentType) params.set("expiredDocumentType", filters.expiredDocumentType);
      if (filters.expiringSoon) params.set("expiringSoon", "true");
      if (filters.hireDateFrom) params.set("hireDateFrom", filters.hireDateFrom);
      if (filters.hireDateTo) params.set("hireDateTo", filters.hireDateTo);
      if (filters.hasAssignment) params.set("hasAssignment", "true");

      const res = await fetch(`/api/employees?${params.toString()}`);
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
    setWeeklyHours((prev) => {
      const next = { ...prev };
      for (const emp of employees) {
        if (weeklySalaryComplete(emp) && next[String(emp.id)] === undefined) {
          next[String(emp.id)] = "40";
        }
      }
      return next;
    });
  }, [employees]);

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
    setSelectedColumns(new Set(COLUMN_OPTIONS.map((c) => c.key)));
  }

  function clearAllColumns() {
    setSelectedColumns(new Set());
  }

  // ── Export ──
  async function handleExport(type: "excel" | "pdf") {
    if (selectedIds.size === 0) {
      alert("Selectează cel puțin un angajat");
      return;
    }
    if (selectedColumns.size === 0 && type === "excel") {
      alert("Selectează cel puțin o coloană");
      return;
    }

    setExporting(type);
    try {
      const endpoint = type === "excel" ? "/api/export/excel" : "/api/export/pdf";
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
        alert(d.error ?? "Eroare la export");
        setExporting(null);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export-angajati-${new Date().toISOString().slice(0, 10)}.${type === "excel" ? "xlsx" : "pdf"}`;
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
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error ?? "Eroare la export salarii");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "csv" ? "csv" : "xlsx";
      a.download = `export-salarii-${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Eroare la export salarii");
    } finally {
      setSalaryExporting(null);
    }
  }

  async function handleWeeklyPayExport() {
    if (selectedIds.size === 0) {
      alert("Selectează cel puțin un angajat");
      return;
    }
    setWeeklyPayExporting(true);
    try {
      const hoursByEmployeeId: Record<string, number> = {};
      for (const id of selectedIds) {
        const raw = weeklyHours[String(id)] ?? "0";
        const n = Number(String(raw).replace(",", "."));
        hoursByEmployeeId[String(id)] = Number.isFinite(n) ? n : 0;
      }
      const res = await fetch("/api/export/weekly-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds: Array.from(selectedIds),
          hoursByEmployeeId,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error ?? "Eroare la export plată săptămânală");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `plata-saptamanala-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Eroare la export plată săptămânală");
    } finally {
      setWeeklyPayExporting(false);
    }
  }

  // ── Preview data ──
  const previewEmployees = employees.slice(0, 5);
  const previewColumns = COLUMN_OPTIONS.filter((c) => selectedColumns.has(c.key));

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Download size={24} className="text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Export Date</h1>
          <p className="text-sm text-gray-500">
            Selectează angajați și coloane, apoi exportă în Excel sau PDF
          </p>
        </div>
      </div>

      {/* Export salarii — independent de pașii de export general */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Export contabilitate / Fișă plăți</h2>
        <p className="text-xs text-gray-500 mb-4">
          Toți angajații din baza de date (cu filtre opționale). Lipsesc date salariale → celulele rămân goale.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={salaryTypeFilter}
            onChange={(e) => setSalaryTypeFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">Toate tipurile de plată</option>
            <option value="LUNAR">LUNAR</option>
            <option value="SAPTAMANAL">SAPTAMANAL</option>
            <option value="ORA">ORA</option>
          </select>
          <select
            value={salaryCurrencyFilter}
            onChange={(e) => setSalaryCurrencyFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">Toate monedele</option>
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
            Doar cu date salariale complete
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
              Export contabilitate (CSV)
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
              Fișă plăți (Excel)
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Coloane: Nume, Prenume, CNP complet, IBAN complet, Bancă, Tip plată, Sumă brută, Monedă, Valabil de la, Status.
        </p>
        <p className="mt-2 text-xs text-amber-700">
          Date confidențiale — conform GDPR, acest export este destinat exclusiv departamentului de contabilitate.
        </p>
      </div>

      {/* Plată săptămânală — instrucțiuni (tabelul cu ore e la pasul 1) */}
      <div className="bg-white rounded-xl border border-violet-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-2">
          <CalendarDays size={18} className="text-violet-600" />
          <h2 className="text-sm font-semibold text-gray-900">Plată săptămânală</h2>
        </div>
        <p className="text-xs text-gray-600 mb-2">
          La pasul <strong>1. Selectează angajați</strong>: bifează angajații, completează{" "}
          <strong>Ore lucrate</strong> pentru cei cu tip plată <strong>ORA</strong> și date salariale complete.
          Rândurile fără date salariale complete sunt evidențiate în galben. Apoi apasă{" "}
          <strong>Generează export plată săptămânală</strong> — fișier Excel cu: Nume complet, CNP, IBAN, Bancă,
          Suma brută/oră, Ore lucrate, Total de plată, Monedă.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {[
          { key: "select" as const, label: "1. Selectează angajați", icon: Users },
          { key: "configure" as const, label: "2. Configurează coloane", icon: Columns3 },
          { key: "preview" as const, label: "3. Preview și export", icon: Eye },
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
            {idx < 2 && <ChevronRight size={14} className="ml-1 opacity-50" />}
          </button>
        ))}
      </div>

      {/* ── STEP 1: Select employees ── */}
      {step === "select" && (
        <div className="space-y-4">
          <AdvancedFilter
            filters={filters}
            onChange={setFilters}
            onApply={fetchEmployees}
            onReset={() => setFilters({ ...defaultFilters })}
            companies={companies}
          />

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
                {loading ? "Se încarcă..." : `${employees.length} angajați găsiți`}
              </span>
              {selectedIds.size > 0 && (
                <span className="text-sm text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                  {selectedIds.size} selectați
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
                        checked={employees.length > 0 && selectedIds.size === employees.length}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Nume</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">CNP</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Tip plată</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 min-w-[9rem]">
                      Ore lucrate
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Funcție</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Firmă</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                        <Loader2 size={20} className="inline animate-spin mr-2" />
                        Se încarcă...
                      </td>
                    </tr>
                  ) : employees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                        <AlertCircle size={20} className="inline mr-2" />
                        Niciun angajat găsit. Ajustează filtrele.
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp) => {
                      const incomplete = !weeklySalaryComplete(emp);
                      const rowHighlight = incomplete
                        ? "bg-amber-50 border-l-4 border-amber-400"
                        : selectedIds.has(emp.id)
                          ? "bg-blue-50"
                          : "hover:bg-gray-50";
                      return (
                        <tr
                          key={emp.id}
                          className={`border-b last:border-b-0 transition-colors cursor-pointer ${rowHighlight}`}
                          onClick={() => toggleSelect(emp.id)}
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
                              <div className="text-xs text-gray-400">{emp.email}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-600">{emp.cnp}</td>
                          <td className="px-4 py-3 text-gray-700">
                            {emp.salaryType ?? "—"}
                          </td>
                          <td
                            className="px-4 py-3"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            {weeklySalaryComplete(emp) ? (
                              <input
                                type="number"
                                min={0}
                                step={0.5}
                                value={weeklyHours[String(emp.id)] ?? "40"}
                                onChange={(e) =>
                                  setWeeklyHours((p) => ({
                                    ...p,
                                    [String(emp.id)]: e.target.value,
                                  }))
                                }
                                className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                              />
                            ) : (
                              <span className="text-xs font-medium text-amber-800">
                                Lipsesc date salariale
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{emp.position ?? "—"}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={emp.status} />
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {emp.company?.name ?? "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Next step button */}
            <div className="px-4 py-3 border-t flex flex-wrap items-center justify-end gap-2 bg-gray-50">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleWeeklyPayExport();
                }}
                disabled={weeklyPayExporting || selectedIds.size === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {weeklyPayExporting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileSpreadsheet size={16} />
                )}
                Generează export plată săptămânală
              </button>
              <button
                onClick={() => setStep("configure")}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Continuă ({selectedIds.size} selectați)
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
              Înapoi la selecție
            </button>
            <span className="text-sm text-gray-500">
              {selectedIds.size} angajați selectați
            </span>
          </div>

          {/* Column selector */}
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Columns3 size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  Coloane pentru export
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
                  Selectează toate
                </button>
                <button
                  onClick={clearAllColumns}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Deselectează toate
                </button>
              </div>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(CATEGORY_LABELS).map(([cat, catLabel]) => (
                <div key={cat}>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {catLabel}
                  </h4>
                  <div className="space-y-1.5">
                    {COLUMN_OPTIONS.filter((c) => c.category === cat).map((col) => (
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
                        <span className="text-sm text-gray-700">{col.label}</span>
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
                Preview și export
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
              Înapoi la coloane
            </button>
            <span className="text-sm text-gray-500">
              {selectedIds.size} angajați × {selectedColumns.size} coloane
            </span>
          </div>

          {/* Preview table */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center gap-2 bg-gray-50">
              <Eye size={16} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                Preview primele 5 rânduri
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
                    <tr key={emp.id} className="border-b last:border-b-0 hover:bg-gray-50">
                      {previewColumns.map((col) => (
                        <td key={col.key} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                          {getPreviewValue(emp, col.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr>
                      <td
                        colSpan={previewColumns.length || 1}
                        className="px-4 py-8 text-center text-gray-400"
                      >
                        Niciun angajat de previzualizat
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {employees.length > 5 && (
              <div className="px-4 py-2 border-t text-xs text-gray-500 bg-gray-50 text-center">
                ... și încă {employees.length - 5} angajați
              </div>
            )}
          </div>

          {/* Export buttons */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Export final</h3>
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
                Export Excel (.xlsx)
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
                Export PDF
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                  {selectedIds.size}
                </span>
              </button>

              <button
                onClick={() => router.push("/angajati")}
                className="flex items-center gap-2 px-5 py-3 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Anulează
              </button>
            </div>

            {/* Warning for sensitive data */}
            {selectedColumns.has("cnp") || selectedColumns.has("iban") ? (
              <div className="mt-4 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-3">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <p>
                  Date confidențiale — conform GDPR, acest export este destinat exclusiv departamentului de contabilitate.
                </p>
              </div>
            ) : null}
          </div>

        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function getPreviewValue(emp: Employee, key: string): string {
  switch (key) {
    case "id": return String(emp.id);
    case "lastName": return emp.lastName;
    case "firstName": return emp.firstName;
    case "cnp": return emp.cnp;
    case "seriesCI": return emp.seriesCI ?? "—";
    case "numberCI": return emp.numberCI ?? "—";
    case "email": return emp.email ?? "—";
    case "phone": return emp.phone ?? "—";
    case "position": return emp.position ?? "—";
    case "status": return emp.status === "ACTIVE" ? "Activ" : "Terminat";
    case "company": return emp.company?.name ?? "—";
    case "address": return emp.address ?? "—";
    case "city": return emp.city ?? "—";
    case "country": return emp.country ?? "—";
    case "hiredAt": return emp.hiredAt ? new Date(emp.hiredAt).toLocaleDateString("ro-RO") : "—";
    case "iban": return emp.iban ?? "—";
    case "bankName": return emp.bankName ?? "—";
    case "salaryType": return emp.salaryType ?? "—";
    case "salaryAmount": return typeof emp.salaryAmount === "number" ? String(emp.salaryAmount) : "—";
    case "salaryCurrency": return emp.salaryCurrency ?? "—";
    case "salaryStartDate":
      return emp.salaryStartDate ? new Date(emp.salaryStartDate).toLocaleDateString("ro-RO") : "—";
    case "observations": return emp.observations ?? "—";
    default: return "—";
  }
}
