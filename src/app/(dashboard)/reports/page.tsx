"use client";

import {
  AlertCircle,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Eye,
  FileText,
  Globe,
  Loader2,
  Lock,
  Printer,
  Search,
  Shield,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { UpgradeModal } from "@/components/plan/UpgradeModal";
import { usePlan } from "@/hooks/use-plan";
import { useTranslation } from "@/hooks/useTranslation";
import { FEATURES, type PlanFeature } from "@/lib/plan-features";
import type { TFunction } from "i18next";

// ─── Types ───────────────────────────────────────────────────────────────────

type ReportType = "lista" | "a1" | "tara" | "fisa";

interface ColumnOption {
  key: string;
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
  /** Client-side successful generation time for “Generated at …”. */
  generatedAt?: string;
}

interface CountryOption {
  id: number;
  name: string;
  code: string;
  phoneCode: string | null;
}

function formatGeneratedAt(iso: string, localeTag: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(localeTag)}, ${d.toLocaleTimeString(localeTag, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function columnHeader(t: TFunction<"translation">, key: string): string {
  return t(`pages.reportsWizard.columns.${key}`);
}

// ─── Constants (non-copy) ─────────────────────────────────────────────────────

const REPORT_TYPE_METAS: {
  type: ReportType;
  icon: typeof FileText;
  color: string;
}[] = [
  { type: "lista", icon: Users, color: "bg-blue-500" },
  { type: "a1", icon: Shield, color: "bg-green-500" },
  { type: "tara", icon: Globe, color: "bg-amber-500" },
  { type: "fisa", icon: FileText, color: "bg-purple-500" },
];

const DEFAULT_COLUMN_SELECTION: ColumnOption[] = [
  { key: "lastName", selected: true },
  { key: "firstName", selected: true },
  { key: "cnp", selected: true },
  { key: "iban", selected: true },
  { key: "bankName", selected: true },
  { key: "salaryType", selected: true },
  { key: "salaryAmount", selected: true },
  { key: "salaryCurrency", selected: true },
  { key: "salaryStartDate", selected: true },
  { key: "companyName", selected: true },
  { key: "position", selected: true },
  { key: "country", selected: true },
  { key: "city", selected: false },
  { key: "email", selected: false },
  { key: "phone", selected: false },
  { key: "status", selected: true },
  { key: "hiredAt", selected: false },
];

function cloneDefaultColumns(): ColumnOption[] {
  return DEFAULT_COLUMN_SELECTION.map((c) => ({ ...c }));
}

function featureForReportType(type: ReportType): PlanFeature {
  if (type === "lista") return FEATURES.EXPORT_PDF;
  return FEATURES.ADVANCED_REPORTS;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { t, currentLanguage } = useTranslation();
  const { canUseFeature } = usePlan();
  const [upgradeFeature, setUpgradeFeature] = useState<PlanFeature | null>(
    null,
  );
  const localeTag = currentLanguage === "ro" ? "ro-RO" : "en-GB";
  const emDash = t("common.emDash");

  const [step, setStep] = useState<"select" | "configure" | "preview">(
    "select",
  );
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [reportTitle, setReportTitle] = useState("");
  const [columns, setColumns] = useState<ColumnOption[]>(() =>
    cloneDefaultColumns(),
  );
  const [countryCode, setCountryCode] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employees, setEmployees] = useState<EmployeeMini[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<number>>(
    new Set(),
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] =
    useState<GeneratedReport | null>(null);
  const [error, setError] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [reportCountries, setReportCountries] = useState<CountryOption[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);

  const reportTypeLabel = useCallback(
    (type: ReportType) => t(`pages.reportsWizard.types.${type}.label`),
    [t],
  );

  // Countries for “tara” report (Country table; same API as settings)
  useEffect(() => {
    if (reportType !== "tara") return;
    let cancelled = false;
    setCountriesLoading(true);
    fetch("/api/organization/countries")
      .then((r) => r.json())
      .then((data: { countries?: CountryOption[] }) => {
        if (cancelled) return;
        const list = data.countries ?? [];
        setReportCountries(
          [...list].sort((a, b) =>
            a.name.localeCompare(b.name, localeTag),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setReportCountries([]);
      })
      .finally(() => {
        if (!cancelled) setCountriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportType, localeTag]);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (employeeSearch) params.set("search", employeeSearch);

      const res = await fetch(`/api/employees?${params.toString()}`);
      if (!res.ok) throw new Error("fetch_failed");
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

  function toggleColumn(key: string) {
    setColumns((prev) =>
      prev.map((c) => (c.key === key ? { ...c, selected: !c.selected } : c)),
    );
  }

  function selectAllColumns() {
    setColumns((prev) => prev.map((c) => ({ ...c, selected: true })));
  }

  function deselectAllColumns() {
    setColumns((prev) => prev.map((c) => ({ ...c, selected: false })));
  }

  function toggleEmployee(id: number) {
    if (reportType === "fisa") {
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

  async function handleGenerate() {
    if (!reportType || generating) return;

    const requiredFeature = featureForReportType(reportType);
    if (!canUseFeature(requiredFeature)) {
      setUpgradeFeature(requiredFeature);
      return;
    }

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
          setError(t("pages.reportsWizard.errSelectEmployees"));
          setGenerating(false);
          return;
        }
        body.employeeIds = ids;
        const selectedCols = columns
          .filter((c) => c.selected)
          .map((c) => ({
            key: c.key,
            header: columnHeader(t, c.key),
            width: 16,
          }));
        if (selectedCols.length > 0) {
          body.columns = selectedCols;
        }
      } else if (reportType === "a1") {
        // Auto-select, no params needed
      } else if (reportType === "tara") {
        if (!countryCode) {
          setError(t("pages.reportsWizard.errSelectCountry"));
          setGenerating(false);
          return;
        }
        const codeU = countryCode.trim().toUpperCase();
        const sel = reportCountries.find(
          (c) => c.code.trim().toUpperCase() === codeU,
        );
        const taraLabel = t("pages.reportsWizard.types.tara.label");
        if (
          sel &&
          (!String(reportTitle ?? "").trim() || reportTitle === taraLabel)
        ) {
          body.title = t("pages.reportsWizard.taraAutoTitle", {
            country: sel.name,
          });
        }
        body.params = {
          countryCode: codeU,
          ...(sel?.name ? { countryDisplayName: sel.name } : {}),
        };
      } else if (reportType === "fisa") {
        if (!selectedEmployeeId) {
          setError(t("pages.reportsWizard.errSelectEmployee"));
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
        setError(
          typeof data.error === "string" && data.error
            ? data.error
            : t("pages.reportsWizard.errGenerateApi"),
        );
        setGenerating(false);
        return;
      }

      setGeneratedReport({
        ...data,
        generatedAt: new Date().toISOString(),
      });

      const pdfRes = await fetch(data.downloadUrl, { credentials: "same-origin" });
      if (pdfRes.ok) {
        const blob = await pdfRes.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      }

      setStep("preview");
    } catch {
      setError(t("pages.reportsWizard.errGenerate"));
    } finally {
      setGenerating(false);
    }
  }

  function handleDownload() {
    if (!generatedReport) return;
    const a = document.createElement("a");
    a.href = generatedReport.downloadUrl;
    a.download = t("pages.reportsWizard.downloadFilename", {
      id: generatedReport.reportId.slice(0, 8),
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handlePrint() {
    if (!pdfUrl) return;
    const win = window.open(pdfUrl, "_blank");
    if (win) {
      win.onload = () => win.print();
    }
  }

  function goBackToReportTypeSelect() {
    setPdfUrl(null);
    setStep("select");
    setReportType(null);
    setReportTitle("");
    setCountryCode("");
    setEmployeeSearch("");
    setSelectedEmployeeIds(new Set());
    setSelectedEmployeeId(null);
    setColumns(cloneDefaultColumns());
    setError("");
    setGeneratedReport(null);
    setGenerating(false);
  }

  function selectReportType(type: ReportType) {
    setReportType(type);
    setCountryCode("");
    setError("");
    setGeneratedReport(null);
    setPdfUrl(null);

    if (type === "lista") {
      setReportTitle(t("pages.reportsWizard.defaultListaTitle"));
    } else {
      setReportTitle(t(`pages.reportsWizard.types.${type}.label`));
    }

    setStep("configure");
  }

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  // ═══ Render ═════════════════════════════════════════════════════════════════

  const generateFeature = reportType
    ? featureForReportType(reportType)
    : FEATURES.EXPORT_PDF;
  const generateLocked = reportType
    ? !canUseFeature(generateFeature)
    : false;

  return (
    <div className="space-y-6">
      <UpgradeModal
        open={upgradeFeature != null}
        onOpenChange={(open) => {
          if (!open) setUpgradeFeature(null);
        }}
        feature={upgradeFeature ?? FEATURES.EXPORT_PDF}
      />
      <div className="flex items-center gap-3">
        <BarChart3 size={24} className="text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("pages.reportsWizard.title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("pages.reportsWizard.subtitle")}
          </p>
        </div>
      </div>

      {step === "select" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-800">
            {t("pages.reportsWizard.stepSelectHeading")}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {REPORT_TYPE_METAS.map((rt) => {
              const typeLocked = !canUseFeature(featureForReportType(rt.type));
              return (
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
                    {t(`pages.reportsWizard.types.${rt.type}.label`)}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                    {t(`pages.reportsWizard.types.${rt.type}.description`)}
                  </p>
                </div>
                {typeLocked ? (
                  <Lock
                    size={16}
                    className="text-amber-500 ml-auto shrink-0 mt-1"
                    aria-hidden
                  />
                ) : (
                  <ChevronRight
                    size={18}
                    className="text-gray-300 group-hover:text-blue-400 ml-auto shrink-0 mt-1"
                  />
                )}
              </button>
            );
            })}
          </div>

          <div className="flex items-start gap-3 bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>{t("pages.reportsWizard.infoBox")}</p>
          </div>
        </div>
      )}

      {step === "configure" && reportType && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={goBackToReportTypeSelect}
              className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <ChevronLeft size={14} />
              {t("pages.reportsWizard.breadcrumbReportType")}
            </button>
            <ChevronRight size={14} className="text-gray-300" />
            <span className="font-medium text-gray-900">
              {reportTypeLabel(reportType)}
            </span>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t("pages.reportsWizard.reportTitleLabel")}
            </label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className="w-full max-w-md px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t("pages.reportsWizard.reportTitlePlaceholder")}
            />
          </div>

          {reportType === "lista" && (
            <>
              <div className="bg-white rounded-xl border shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Columns3 size={16} className="text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      {t("pages.reportsWizard.columnsIncluded")}
                    </span>
                    <span className="text-xs bg-slate-900 text-white px-2 py-0.5 rounded-full">
                      {columns.filter((c) => c.selected).length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllColumns}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      {t("pages.reportsWizard.selectAllColumns")}
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllColumns}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      {t("pages.reportsWizard.deselectAllColumns")}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {columns.map((col) => (
                    <button
                      type="button"
                      key={col.key}
                      onClick={() => toggleColumn(col.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        col.selected
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200"
                      }`}
                    >
                      {col.selected && <Check size={12} />}
                      {columnHeader(t, col.key)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      {t("pages.reportsWizard.selectEmployees")}
                    </span>
                    <span className="text-xs bg-slate-900 text-white px-2 py-0.5 rounded-full">
                      {selectedEmployeeIds.size}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllEmployees}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      {t("pages.reportsWizard.selectAllEmployees")}
                    </button>
                    <button
                      type="button"
                      onClick={clearEmployeeSelection}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      {t("pages.reportsWizard.clearEmployeeSelection")}
                    </button>
                  </div>
                </div>

                <div className="px-4 py-2 border-b bg-gray-50">
                  <div className="relative max-w-sm">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="text"
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      placeholder={t(
                        "pages.reportsWizard.searchEmployeePlaceholder",
                      )}
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border bg-white text-sm"
                    />
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto">
                  {loading ? (
                    <div className="px-4 py-8 text-center text-gray-400">
                      <Loader2 size={18} className="inline animate-spin mr-2" />
                      {t("pages.reportsWizard.loading")}
                    </div>
                  ) : employees.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-400">
                      {t("pages.reportsWizard.noEmployeesFound")}
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
                            {emp.position ?? emDash} ·{" "}
                            {emp.company?.name ?? emDash}
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

          {reportType === "a1" && (
            <div className="bg-green-50 rounded-xl border border-green-200 p-6 text-center">
              <Shield size={32} className="mx-auto text-green-500 mb-3" />
              <h3 className="font-semibold text-green-900 mb-1">
                {t("pages.reportsWizard.a1BlockTitle")}
              </h3>
              <p className="text-sm text-green-700 max-w-md mx-auto">
                {t("pages.reportsWizard.a1BlockDescription")}
              </p>
              <p className="text-sm text-green-600 mt-2">
                {t("pages.reportsWizard.a1BlockNoExtra")}
              </p>
            </div>
          )}

          {reportType === "tara" && (
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Globe size={14} className="inline mr-1" />
                {t("pages.reportsWizard.selectCountryLabel")}
              </label>
              {countriesLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                  <Loader2 size={18} className="animate-spin" />
                  {t("pages.reportsWizard.loadingCountries")}
                </div>
              ) : reportCountries.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {t("pages.reportsWizard.noCountriesHint")}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {reportCountries.map((c) => {
                    const codeU = c.code.trim().toUpperCase();
                    const active = countryCode === codeU;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCountryCode(codeU)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? "bg-amber-500 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        <span
                          className={`font-mono text-xs ${active ? "text-amber-100" : "text-gray-500"}`}
                        >
                          {codeU}
                        </span>
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {reportType === "fisa" && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <div className="flex items-center gap-2">
                  <Search size={16} className="text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {t("pages.reportsWizard.fisaSearchHeading")}
                  </span>
                </div>
              </div>

              <div className="px-4 py-2 border-b">
                <input
                  type="text"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  placeholder={t(
                    "pages.reportsWizard.fisaSearchPlaceholder",
                  )}
                  className="w-full max-w-sm px-3 py-2 rounded-lg border bg-white text-sm"
                />
              </div>

              <div className="max-h-64 overflow-y-auto">
                {loading ? (
                  <div className="px-4 py-8 text-center text-gray-400">
                    <Loader2 size={18} className="inline animate-spin mr-2" />
                    {t("pages.reportsWizard.loading")}
                  </div>
                ) : employees.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-400">
                    {t("pages.reportsWizard.noEmployeesFound")}
                  </div>
                ) : (
                  employees.map((emp) => (
                    <label
                      key={emp.id}
                      className={`flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 cursor-pointer transition-colors ${
                        selectedEmployeeId === emp.id
                          ? "bg-purple-50"
                          : "hover:bg-gray-50"
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
                          {emp.position ?? emDash} ·{" "}
                          {emp.company?.name ?? emDash}
                        </div>
                      </div>
                      <StatusBadge status={emp.status} />
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg p-3">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (generateLocked) {
                  setUpgradeFeature(generateFeature);
                  return;
                }
                void handleGenerate();
              }}
              disabled={generating && !generateLocked}
              aria-busy={generating || undefined}
              className={`inline-flex min-w-[11.5rem] items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                generateLocked
                  ? "bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200"
                  : "bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-70 disabled:cursor-wait"
              }`}
            >
              {generating && !generateLocked ? (
                <>
                  <Loader2
                    size={16}
                    className="shrink-0 animate-spin"
                    aria-hidden
                  />
                  <span>{t("pages.reportsWizard.generating")}</span>
                </>
              ) : (
                <>
                  {generateLocked ? (
                    <Lock size={16} className="shrink-0" aria-hidden />
                  ) : (
                    <FileText size={16} className="shrink-0" aria-hidden />
                  )}
                  <span>{t("pages.reportsWizard.generatePdf")}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={goBackToReportTypeSelect}
              className="px-4 py-2.5 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t("pages.reportsWizard.cancel")}
            </button>
          </div>
        </div>
      )}

      {step === "preview" && generatedReport && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => {
                setStep("configure");
                setPdfUrl(null);
              }}
              className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <ChevronLeft size={14} />
              {t("pages.reportsWizard.breadcrumbConfigure")}
            </button>
            <ChevronRight size={14} className="text-gray-300" />
            <span className="font-medium text-gray-900">
              {t("pages.reportsWizard.breadcrumbPreview")}
            </span>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">
                {generatedReport.title}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {t("pages.reportsWizard.employeeCountLine", {
                  count: generatedReport.employeeCount,
                })}
                {generatedReport.generatedAt ? (
                  <>
                    {" "}
                    · {t("pages.reportsWizard.generatedAtPrefix")}{" "}
                    {formatGeneratedAt(
                      generatedReport.generatedAt,
                      localeTag,
                    )}
                  </>
                ) : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Download size={14} />
                {t("pages.reportsWizard.download")}
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Printer size={14} />
                {t("pages.reportsWizard.print")}
              </button>
            </div>
          </div>

          {pdfUrl ? (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-2 border-b bg-gray-50 flex items-center gap-2">
                <Eye size={14} className="text-gray-500" />
                <span className="text-sm text-gray-600">
                  {t("pages.reportsWizard.pdfPreviewLabel")}
                </span>
              </div>
              <iframe
                ref={iframeRef}
                src={pdfUrl}
                className="w-full h-[600px]"
                title={t("pages.reportsWizard.pdfIframeTitle")}
              />
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl border p-12 text-center">
              <FileText size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">
                {t("pages.reportsWizard.previewUnavailable")}
              </p>
              <button
                type="button"
                onClick={handleDownload}
                className="mt-3 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                {t("pages.reportsWizard.downloadPdf")}
              </button>
            </div>
          )}

          <div className="text-center pt-4">
            <button
              type="button"
              onClick={() => {
                setStep("select");
                setReportType(null);
                setGeneratedReport(null);
                setPdfUrl(null);
                setError("");
              }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              {t("pages.reportsWizard.newReport")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const known = t(`pages.reportsWizard.statusBadge.${status}`, {
    defaultValue: "",
  });
  const label =
    known ||
    status;
  const style: Record<string, { bg: string; text: string }> = {
    ACTIVE: { bg: "bg-green-100", text: "text-green-700" },
    TERMINATED: { bg: "bg-red-100", text: "text-red-700" },
  };
  const c = style[status] ?? {
    bg: "bg-gray-100",
    text: "text-gray-700",
  };
  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}
    >
      {label}
    </span>
  );
}
