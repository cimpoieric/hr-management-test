"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  BarChart3,
  FileText,
  Users,
  Globe,
  Shield,
  Loader2,
  Download,
  Printer,
  Eye,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Search,
  Columns3,
  Check,
  FileSpreadsheet,
} from "lucide-react";
import { DEPLOYMENT_COUNTRIES } from "@/lib/countries";

// ─── Types ───────────────────────────────────────────────────────────────────

type ReportType = "lista" | "a1" | "tara" | "fisa";

interface ReportConfig {
  type: ReportType;
  title: string;
  employeeIds: number[];
  columns?: ColumnOption[];
  countryCode?: string;
  employeeId?: number;
}

interface ColumnOption {
  key: string;
  header: string;
  selected: boolean;
}

interface EmployeeMini {
  id: number;
  lastName: string;
  firstName: string;
  position: string | null;
  status: string;
  company: { name: string } | null;
}

interface GeneratedReport {
  reportId: string;
  downloadUrl: string;
  expiresAt: string;
  title: string;
  employeeCount: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const REPORT_TYPES: {
  type: ReportType;
  label: string;
  description: string;
  icon: typeof FileText;
  color: string;
}[] = [
  {
    type: "lista",
    label: "Listă angajați",
    description: "Raport general cu coloane configurabile. Ideal pentru management.",
    icon: Users,
    color: "bg-blue-500",
  },
  {
    type: "a1",
    label: "Status A1",
    description: "Verificare certificate A1 pentru angajații detașați. Auto-generat.",
    icon: Shield,
    color: "bg-green-500",
  },
  {
    type: "tara",
    label: "Raport pe țară",
    description: "Angajați detașați într-o țară specifică. Util pentru firme partenere.",
    icon: Globe,
    color: "bg-amber-500",
  },
  {
    type: "fisa",
    label: "Fișă angajat",
    description: "Fișă completă individuală cu date personale, contract, documente.",
    icon: FileText,
    color: "bg-purple-500",
  },
];

const DEFAULT_COLUMNS: ColumnOption[] = [
  { key: "lastName", header: "Nume", selected: true },
  { key: "firstName", header: "Prenume", selected: true },
  { key: "cnp", header: "CNP", selected: true },
  { key: "iban", header: "IBAN", selected: true },
  { key: "bankName", header: "Bancă", selected: true },
  { key: "salaryType", header: "Tip plată", selected: true },
  { key: "salaryAmount", header: "Sumă brută", selected: true },
  { key: "salaryCurrency", header: "Monedă", selected: true },
  { key: "salaryStartDate", header: "Valabil de la", selected: true },
  { key: "companyName", header: "Firmă", selected: true },
  { key: "position", header: "Funcție", selected: true },
  { key: "country", header: "Țară", selected: true },
  { key: "city", header: "Oraș", selected: false },
  { key: "email", header: "Email", selected: false },
  { key: "phone", header: "Telefon", selected: false },
  { key: "status", header: "Status", selected: true },
  { key: "hiredAt", header: "Data angajării", selected: false },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export default function RapoartePage() {
  const [step, setStep] = useState<"select" | "configure" | "preview">("select");
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [reportTitle, setReportTitle] = useState("");
  const [columns, setColumns] = useState<ColumnOption[]>(DEFAULT_COLUMNS);
  const [countryCode, setCountryCode] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employees, setEmployees] = useState<EmployeeMini[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<number>>(new Set());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [error, setError] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── Fetch employees for selection ──
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (employeeSearch) params.set("search", employeeSearch);

      const res = await fetch(`/api/employees?${params.toString()}`);
      if (!res.ok) throw new Error("Eroare");
      const data = await res.json();
      setEmployees(data.data ?? []);
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [employeeSearch]);

  useEffect(() => {
    if (reportType === "lista" || reportType === "fisa") {
      fetchEmployees();
    }
  }, [fetchEmployees, reportType]);

  // ── Column helpers ──
  function toggleColumn(key: string) {
    setColumns((prev) =>
      prev.map((c) => (c.key === key ? { ...c, selected: !c.selected } : c))
    );
  }

  function selectAllColumns() {
    setColumns((prev) => prev.map((c) => ({ ...c, selected: true })));
  }

  function deselectAllColumns() {
    setColumns((prev) => prev.map((c) => ({ ...c, selected: false })));
  }

  // ── Employee selection ──
  function toggleEmployee(id: number) {
    if (reportType === "fisa") {
      // Single select for "fisa"
      setSelectedEmployeeId((prev) => (prev === id ? null : id));
      setSelectedEmployeeIds(new Set(id ? [id] : []));
    } else {
      setSelectedEmployeeIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  }

  function selectAllEmployees() {
    setSelectedEmployeeIds(new Set(employees.map((e) => e.id)));
  }

  function clearEmployeeSelection() {
    setSelectedEmployeeIds(new Set());
    setSelectedEmployeeId(null);
  }

  // ── Generate report ──
  async function handleGenerate() {
    if (!reportType) return;
    setGenerating(true);
    setError("");

    try {
      const body: Record<string, unknown> = {
        type: reportType,
        title: reportTitle || undefined,
      };

      if (reportType === "lista") {
        const ids = Array.from(selectedEmployeeIds);
        if (ids.length === 0) {
          setError("Selectează cel puțin un angajat");
          setGenerating(false);
          return;
        }
        body.employeeIds = ids;
        const selectedCols = columns
          .filter((c) => c.selected)
          .map((c) => ({ key: c.key, header: c.header, width: 16 }));
        if (selectedCols.length > 0) {
          body.columns = selectedCols;
        }
      } else if (reportType === "a1") {
        // Auto-select, no params needed
      } else if (reportType === "tara") {
        if (!countryCode) {
          setError("Selectează o țară");
          setGenerating(false);
          return;
        }
        body.params = { countryCode };
      } else if (reportType === "fisa") {
        if (!selectedEmployeeId) {
          setError("Selectează un angajat");
          setGenerating(false);
          return;
        }
        body.params = { employeeId: selectedEmployeeId };
      }

      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Eroare la generare");
        setGenerating(false);
        return;
      }

      setGeneratedReport(data);

      // Load PDF for preview
      const pdfRes = await fetch(data.downloadUrl);
      if (pdfRes.ok) {
        const blob = await pdfRes.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      }

      setStep("preview");
    } catch {
      setError("Eroare la generare raport");
    } finally {
      setGenerating(false);
    }
  }

  // ── Download ──
  function handleDownload() {
    if (!generatedReport) return;
    const a = document.createElement("a");
    a.href = generatedReport.downloadUrl;
    a.download = `raport-${generatedReport.reportId.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ── Print ──
  function handlePrint() {
    if (!pdfUrl) return;
    const win = window.open(pdfUrl, "_blank");
    if (win) {
      win.onload = () => win.print();
    }
  }

  // ── Select report type ──
  function selectReportType(type: ReportType) {
    setReportType(type);
    setError("");
    setGeneratedReport(null);
    setPdfUrl(null);

    // Set default title
    if (type === "lista") {
      setReportTitle("Raport salarial — confidențial");
    } else {
      const rt = REPORT_TYPES.find((r) => r.type === type);
      if (rt) setReportTitle(rt.label);
    }

    setStep("configure");
  }

  // ── Cleanup PDF URL on unmount ──
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  // ═══ Render ═════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 size={24} className="text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rapoarte</h1>
          <p className="text-sm text-gray-500">
            Generează rapoarte profesionale PDF pentru management și contabilitate
          </p>
        </div>
      </div>

      {/* ─── STEP 1: Select report type ─── */}
      {step === "select" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-800">
            Selectează tipul de raport
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {REPORT_TYPES.map((rt) => (
              <button
                key={rt.type}
                onClick={() => selectReportType(rt.type)}
                className="group flex items-start gap-4 p-5 rounded-xl border bg-white hover:border-blue-300 hover:shadow-md transition-all text-left"
              >
                <div
                  className={`${rt.color} text-white p-3 rounded-lg shrink-0 group-hover:scale-105 transition-transform`}
                >
                  <rt.icon size={22} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {rt.label}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                    {rt.description}
                  </p>
                </div>
                <ChevronRight
                  size={18}
                  className="text-gray-300 group-hover:text-blue-400 ml-auto shrink-0 mt-1"
                />
              </button>
            ))}
          </div>

          {/* Info box */}
          <div className="flex items-start gap-3 bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>
              Toate rapoartele includ header profesional cu logo (dacă e configurat în setări),
              footer cu paginare și disclaimer GDPR. Rapoartele sunt valabile 24 ore.
            </p>
          </div>
        </div>
      )}

      {/* ─── STEP 2: Configure ─── */}
      {step === "configure" && reportType && (
        <div className="space-y-6">
          {/* Navigation */}
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setStep("select")}
              className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <ChevronLeft size={14} />
              Tip raport
            </button>
            <ChevronRight size={14} className="text-gray-300" />
            <span className="font-medium text-gray-900">
              {REPORT_TYPES.find((r) => r.type === reportType)?.label}
            </span>
          </div>

          {/* Report title */}
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Titlu raport
            </label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className="w-full max-w-md px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Titlu raport..."
            />
          </div>

          {/* ─── Config: Listă ─── */}
          {reportType === "lista" && (
            <>
              {/* Column selector */}
              <div className="bg-white rounded-xl border shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Columns3 size={16} className="text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      Coloane incluse
                    </span>
                    <span className="text-xs bg-slate-900 text-white px-2 py-0.5 rounded-full">
                      {columns.filter((c) => c.selected).length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAllColumns}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Toate
                    </button>
                    <button
                      onClick={deselectAllColumns}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Niciuna
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {columns.map((col) => (
                    <button
                      key={col.key}
                      onClick={() => toggleColumn(col.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        col.selected
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200"
                      }`}
                    >
                      {col.selected && <Check size={12} />}
                      {col.header}
                    </button>
                  ))}
                </div>
              </div>

              {/* Employee selection */}
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      Selectează angajați
                    </span>
                    <span className="text-xs bg-slate-900 text-white px-2 py-0.5 rounded-full">
                      {selectedEmployeeIds.size}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAllEmployees}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Toți
                    </button>
                    <button
                      onClick={clearEmployeeSelection}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Niciunul
                    </button>
                  </div>
                </div>

                {/* Search */}
                <div className="px-4 py-2 border-b bg-gray-50">
                  <div className="relative max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      placeholder="Caută angajat..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border bg-white text-sm"
                    />
                  </div>
                </div>

                {/* Employee list */}
                <div className="max-h-64 overflow-y-auto">
                  {loading ? (
                    <div className="px-4 py-8 text-center text-gray-400">
                      <Loader2 size={18} className="inline animate-spin mr-2" />
                      Se încarcă...
                    </div>
                  ) : employees.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-400">
                      Niciun angajat găsit
                    </div>
                  ) : (
                    employees.map((emp) => (
                      <label
                        key={emp.id}
                        className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEmployeeIds.has(emp.id)}
                          onChange={() => toggleEmployee(emp.id)}
                          className="rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">
                            {emp.lastName} {emp.firstName}
                          </div>
                          <div className="text-xs text-gray-400">
                            {emp.position ?? "—"} · {emp.company?.name ?? "—"}
                          </div>
                        </div>
                        <StatusBadge status={emp.status} />
                      </label>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* ─── Config: A1 ─── */}
          {reportType === "a1" && (
            <div className="bg-green-50 rounded-xl border border-green-200 p-6 text-center">
              <Shield size={32} className="mx-auto text-green-500 mb-3" />
              <h3 className="font-semibold text-green-900 mb-1">
                Raport Status A1
              </h3>
              <p className="text-sm text-green-700 max-w-md mx-auto">
                Acest raport selectează automat toți angajații cu detașare activă și
                verifică statusul certificatului A1 pentru fiecare.
              </p>
              <p className="text-sm text-green-600 mt-2">
                Nu sunt necesare configurări suplimentare.
              </p>
            </div>
          )}

          {/* ─── Config: Țară ─── */}
          {reportType === "tara" && (
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Globe size={14} className="inline mr-1" />
                Selectează țara
              </label>
              <div className="flex flex-wrap gap-2">
                {DEPLOYMENT_COUNTRIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => setCountryCode(c.code)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      countryCode === c.code
                        ? "bg-amber-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <span>{c.flag}</span>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── Config: Fișă ─── */}
          {reportType === "fisa" && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <div className="flex items-center gap-2">
                  <Search size={16} className="text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    Caută angajat
                  </span>
                </div>
              </div>

              <div className="px-4 py-2 border-b">
                <input
                  type="text"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  placeholder="Nume, prenume, CNP..."
                  className="w-full max-w-sm px-3 py-2 rounded-lg border bg-white text-sm"
                />
              </div>

              <div className="max-h-64 overflow-y-auto">
                {loading ? (
                  <div className="px-4 py-8 text-center text-gray-400">
                    <Loader2 size={18} className="inline animate-spin mr-2" />
                    Se încarcă...
                  </div>
                ) : employees.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-400">
                    Niciun angajat găsit
                  </div>
                ) : (
                  employees.map((emp) => (
                    <label
                      key={emp.id}
                      className={`flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 cursor-pointer transition-colors ${
                        selectedEmployeeId === emp.id ? "bg-purple-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="employee"
                        checked={selectedEmployeeId === emp.id}
                        onChange={() => toggleEmployee(emp.id)}
                        className="rounded-full"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {emp.lastName} {emp.firstName}
                        </div>
                        <div className="text-xs text-gray-400">
                          {emp.position ?? "—"} · {emp.company?.name ?? "—"}
                        </div>
                      </div>
                      <StatusBadge status={emp.status} />
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg p-3">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {generating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Se generează...
                </>
              ) : (
                <>
                  <FileText size={16} />
                  Generează PDF
                </>
              )}
            </button>
            <button
              onClick={() => setStep("select")}
              className="px-4 py-2.5 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Anulează
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: Preview ─── */}
      {step === "preview" && generatedReport && (
        <div className="space-y-4">
          {/* Navigation */}
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => {
                setStep("configure");
                setPdfUrl(null);
              }}
              className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <ChevronLeft size={14} />
              Configurare
            </button>
            <ChevronRight size={14} className="text-gray-300" />
            <span className="font-medium text-gray-900">Preview</span>
          </div>

          {/* Report info */}
          <div className="bg-white rounded-xl border shadow-sm p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">
                {generatedReport.title}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {generatedReport.employeeCount} angajați · Expiră la{" "}
                {new Date(generatedReport.expiresAt).toLocaleString("ro-RO")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Download size={14} />
                Descarcă
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Printer size={14} />
                Print
              </button>
            </div>
          </div>

          {/* PDF Preview */}
          {pdfUrl ? (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-2 border-b bg-gray-50 flex items-center gap-2">
                <Eye size={14} className="text-gray-500" />
                <span className="text-sm text-gray-600">Previzualizare PDF</span>
              </div>
              <iframe
                ref={iframeRef}
                src={pdfUrl}
                className="w-full h-[600px]"
                title="PDF Preview"
              />
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl border p-12 text-center">
              <FileText size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">PDF generat, dar previzualizarea nu e disponibilă</p>
              <button
                onClick={handleDownload}
                className="mt-3 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                Descarcă PDF
              </button>
            </div>
          )}

          {/* New report */}
          <div className="text-center pt-4">
            <button
              onClick={() => {
                setStep("select");
                setReportType(null);
                setGeneratedReport(null);
                setPdfUrl(null);
                setError("");
              }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Generează alt raport
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper Components ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    ACTIVE: { bg: "bg-green-100", text: "text-green-700", label: "Activ" },
    TERMINATED: { bg: "bg-red-100", text: "text-red-700", label: "Terminat" },
  };
  const c = config[status] ?? { bg: "bg-gray-100", text: "text-gray-700", label: status };
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
