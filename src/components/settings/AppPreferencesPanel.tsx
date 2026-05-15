/* eslint-disable no-alert */
"use client";

import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import { COMPANY_LOGO_CHANGED_EVENT } from "@/lib/companyLogoEvents";
import {
  AlertCircle,
  Bell,
  Building2,
  Check,
  Database,
  Globe2,
  Image as ImageIcon,
  Info,
  Loader2,
  Settings,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import { preventWheelOnFocusedNumberInput } from "@/lib/numericInput";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const fieldInputClass =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-950";

function SettingsField({
  id,
  label,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5 text-gray-900">
        {label}
      </Label>
      {children}
      {hint ? (
        <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function AppPreferencesPanel() {
  const { t } = useTranslation();
  const { can } = useAuth();

  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [logoExists, setLogoExists] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [dbPath, setDbPath] = useState("");
  const [importingDb, setImportingDb] = useState(false);
  const dbInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    companyName: "",
    companyCuiReg: "",
    companyAddress: "",
    legalRepName: "",
    legalRepRole: "",
    companyIban: "",
    companyBank: "",
    salaryDefaultCurrency: "RON",
    salaryDefaultType: "LUNAR",
    standardMonthlyHours: 168,
    standardWeeklyHours: 40,
    dateFormat: "DD.MM.YYYY",
    language: "en",
    timezone: "Europe/Bucharest",
    alertExpiredDocumentsDays: 30,
    alertExpiringDeploymentsDays: 7,
    inAppNotificationsEnabled: true,
  });

  const canWrite = can("write");

  const checkLogo = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/logo");
      if (!res.ok) return;
      const data = await res.json();
      setLogoExists(Boolean(data.exists));
      if (data.exists && data.url) setLogoUrl(String(data.url));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void checkLogo();
  }, [checkLogo]);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("Failed")),
      )
      .then((data) => {
        setForm({
          companyName: data.companyName ?? "",
          companyCuiReg: data.companyCuiReg ?? "",
          companyAddress: data.companyAddress ?? "",
          legalRepName: data.legalRepName ?? "",
          legalRepRole: data.legalRepRole ?? "",
          companyIban: data.companyIban ?? "",
          companyBank: data.companyBank ?? "",
          salaryDefaultCurrency: data.salaryDefaultCurrency ?? "RON",
          salaryDefaultType: data.salaryDefaultType ?? "LUNAR",
          standardMonthlyHours: Number(data.standardMonthlyHours ?? 168),
          standardWeeklyHours: Number(data.standardWeeklyHours ?? 40),
          dateFormat: data.dateFormat ?? "DD.MM.YYYY",
          language: data.language ?? "en",
          timezone: data.timezone ?? "Europe/Bucharest",
          alertExpiredDocumentsDays: Number(
            data.alertExpiredDocumentsDays ?? 30,
          ),
          alertExpiringDeploymentsDays: Number(
            data.alertExpiringDeploymentsDays ?? 7,
          ),
          inAppNotificationsEnabled: data.inAppNotificationsEnabled !== false,
        });
        setDbPath(data.dbPath ?? "");
      })
      .catch(() => {
        // keep defaults
      });
  }, []);

  function setField(key: string, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSaveSettings() {
    if (!canWrite) return;
    setSavingSettings(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Nu am putut salva setarile.");
        return;
      }
      setMessage("Setarile au fost salvate.");
    } catch {
      setError("Nu am putut salva setarile.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleUpload(file: File) {
    if (!canWrite) return;
    setUploading(true);
    setMessage("");
    setError("");
    try {
      if (!file.type.startsWith("image/")) {
        setError(t("components.appPreferences.imageOnly"));
        return;
      }
      if (file.size > 500 * 1024) {
        setError(t("components.appPreferences.maxSize"));
        return;
      }
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/settings/logo", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        const err =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : t("components.appPreferences.uploadFailed");
        setError(err);
        return;
      }
      setMessage(t("components.appPreferences.uploadSuccess"));
      await checkLogo();
      window.dispatchEvent(new Event(COMPANY_LOGO_CHANGED_EVENT));
    } catch {
      setError(t("components.appPreferences.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!canWrite) return;
    if (!confirm(t("components.appPreferences.confirmDeleteLogo"))) return;
    try {
      const res = await fetch("/api/settings/logo", { method: "DELETE" });
      if (res.ok) {
        setMessage("Logo sters");
        setLogoExists(false);
        setLogoUrl(null);
        window.dispatchEvent(new Event(COMPANY_LOGO_CHANGED_EVENT));
      } else {
        setError(t("components.appPreferences.deleteFailed"));
      }
    } catch {
      setError(t("components.appPreferences.deleteFailed"));
    }
  }

  async function handleDatabaseExport() {
    if (!canWrite) return;
    try {
      const res = await fetch("/api/settings/database-export");
      if (!res.ok) {
        const d: unknown = await res.json().catch(() => ({}));
        const err =
          typeof d === "object" &&
          d !== null &&
          "error" in d &&
          typeof (d as { error: unknown }).error === "string"
            ? (d as { error: string }).error
            : t("components.appPreferences.exportFailed");
        setError(err);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dev-${new Date().toISOString().slice(0, 10)}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError(t("components.appPreferences.exportFailed"));
    }
  }

  async function handleDatabaseImport(file: File) {
    if (!canWrite) return;
    setImportingDb(true);
    setMessage("");
    setError("");
    try {
      const formData = new FormData();
      formData.append("database", file);
      const res = await fetch("/api/settings/database-import", {
        method: "POST",
        body: formData,
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : t("components.appPreferences.importFailed");
        setError(err);
        return;
      }
      const warn =
        typeof data === "object" &&
        data !== null &&
        "warning" in data &&
        typeof (data as { warning: unknown }).warning === "string"
          ? (data as { warning: string }).warning
          : undefined;
      setMessage(warn ?? t("components.appPreferences.importDone"));
    } catch {
      setError(t("components.appPreferences.importFailed"));
    } finally {
      setImportingDb(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (!canWrite) return;
    const file = e.dataTransfer.files[0];
    if (file) void handleUpload(file);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <ImageIcon size={18} className="text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              {t("components.appPreferences.logoTitle")}
            </h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {t("components.appPreferences.logoSubtitle")}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {logoExists && logoUrl && (
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element -- preview URL from API */}
              <img
                src={logoUrl}
                alt={t("components.appPreferences.logoCurrent")}
                className="h-16 object-contain"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">
                  {t("components.appPreferences.logoCurrent")}
                </p>
                <p className="text-xs text-gray-500">
                  {t("components.appPreferences.logoCurrentHint")}
                </p>
              </div>
              <button
                onClick={handleDelete}
                disabled={!canWrite}
                className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                title={t("components.appPreferences.deleteLogoTitle")}
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}

          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-300 transition-colors cursor-pointer"
            onClick={() => {
              if (canWrite) fileInputRef.current?.click();
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
              }}
              className="hidden"
            />

            {uploading ? (
              <Loader2
                size={32}
                className="mx-auto text-blue-500 animate-spin mb-3"
              />
            ) : (
              <Upload size={32} className="mx-auto text-gray-300 mb-3" />
            )}

            <p className="text-sm font-medium text-gray-700">
              {uploading
                ? t("components.appPreferences.uploading")
                : t("components.appPreferences.uploadPrompt")}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {t("components.appPreferences.uploadHint")}
            </p>
            {!canWrite && (
              <p className="mt-2 text-xs text-gray-400">
                {t("components.appPreferences.readOnlyHint")}
              </p>
            )}
          </div>

          <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg p-3">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>{t("components.appPreferences.logoInfoBlue")}</p>
          </div>

          {message && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg p-3">
              <Check size={14} />
              {message}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg p-3">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-6 py-4 border-b flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              {t("components.appPreferences.generalTitle")}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={savingSettings || !canWrite}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {savingSettings ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
            {t("components.appPreferences.saveSettings")}
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="rounded-xl border p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Building2 size={15} className="text-gray-500" />
              {t("components.appPreferences.companySection")}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SettingsField
                id="settings-company-name"
                label={t("components.appPreferences.lblCompanyName")}
                hint={t("components.appPreferences.hintCompanyName")}
              >
                <input
                  id="settings-company-name"
                  value={form.companyName}
                  onChange={(e) => setField("companyName", e.target.value)}
                  placeholder={t("components.appPreferences.phCompanyName")}
                  className={fieldInputClass}
                  disabled={!canWrite}
                />
              </SettingsField>
              <SettingsField
                id="settings-company-cui"
                label={t("components.appPreferences.lblCuiTaxId")}
                hint={t("components.appPreferences.hintCuiTaxId")}
              >
                <input
                  id="settings-company-cui"
                  value={form.companyCuiReg}
                  onChange={(e) => setField("companyCuiReg", e.target.value)}
                  placeholder={t("components.appPreferences.phCuiReg")}
                  className={fieldInputClass}
                  disabled={!canWrite}
                />
              </SettingsField>
              <SettingsField
                id="settings-legal-name"
                label={t("components.appPreferences.lblAdminName")}
                hint={t("components.appPreferences.hintAdminName")}
              >
                <input
                  id="settings-legal-name"
                  value={form.legalRepName}
                  onChange={(e) => setField("legalRepName", e.target.value)}
                  placeholder={t("components.appPreferences.phLegalName")}
                  className={fieldInputClass}
                  disabled={!canWrite}
                />
              </SettingsField>
              <SettingsField
                id="settings-legal-role"
                label={t("components.appPreferences.lblPosition")}
                hint={t("components.appPreferences.hintPosition")}
              >
                <input
                  id="settings-legal-role"
                  value={form.legalRepRole}
                  onChange={(e) => setField("legalRepRole", e.target.value)}
                  placeholder={t("components.appPreferences.phLegalRole")}
                  className={fieldInputClass}
                  disabled={!canWrite}
                />
              </SettingsField>
              <SettingsField
                id="settings-company-iban"
                label={t("components.appPreferences.lblBankAccount")}
                hint={t("components.appPreferences.hintBankAccount")}
              >
                <input
                  id="settings-company-iban"
                  value={form.companyIban}
                  onChange={(e) =>
                    setField("companyIban", e.target.value.toUpperCase())
                  }
                  placeholder={t("components.appPreferences.phIban")}
                  className={fieldInputClass}
                  disabled={!canWrite}
                />
              </SettingsField>
              <SettingsField
                id="settings-company-bank"
                label={t("components.appPreferences.lblBankName")}
                hint={t("components.appPreferences.hintBankName")}
              >
                <input
                  id="settings-company-bank"
                  value={form.companyBank}
                  onChange={(e) => setField("companyBank", e.target.value)}
                  placeholder={t("components.appPreferences.phBank")}
                  className={fieldInputClass}
                  disabled={!canWrite}
                />
              </SettingsField>
              <SettingsField
                id="settings-company-address"
                label={t("components.appPreferences.lblAddress")}
                hint={t("components.appPreferences.hintAddress")}
                className="sm:col-span-2"
              >
                <textarea
                  id="settings-company-address"
                  value={form.companyAddress}
                  onChange={(e) => setField("companyAddress", e.target.value)}
                  placeholder={t("components.appPreferences.phAddress")}
                  className={fieldInputClass}
                  rows={2}
                  disabled={!canWrite}
                />
              </SettingsField>
            </div>
          </div>

          <div className="rounded-xl border p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Wallet size={15} className="text-gray-500" />
              {t("components.appPreferences.salarySection")}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SettingsField
                id="settings-salary-currency"
                label={t("components.appPreferences.lblCurrency")}
                hint={t("components.appPreferences.hintCurrency")}
              >
                <select
                  id="settings-salary-currency"
                  value={form.salaryDefaultCurrency}
                  onChange={(e) =>
                    setField("salaryDefaultCurrency", e.target.value)
                  }
                  className={fieldInputClass}
                  disabled={!canWrite}
                >
                  <option value="RON">RON</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </SettingsField>
              <SettingsField
                id="settings-salary-type"
                label={t("components.appPreferences.lblSalaryType")}
                hint={t("components.appPreferences.hintSalaryType")}
              >
                <select
                  id="settings-salary-type"
                  value={form.salaryDefaultType}
                  onChange={(e) => setField("salaryDefaultType", e.target.value)}
                  className={fieldInputClass}
                  disabled={!canWrite}
                >
                  <option value="LUNAR">
                    {t("components.appPreferences.salaryMonthly")}
                  </option>
                  <option value="SAPTAMANAL">
                    {t("components.appPreferences.salaryWeekly")}
                  </option>
                  <option value="ORA">
                    {t("components.appPreferences.salaryHourly")}
                  </option>
                </select>
              </SettingsField>
              <SettingsField
                id="settings-weekly-hours"
                label={t("components.appPreferences.lblHoursPerWeek")}
                hint={t("components.appPreferences.hintHoursPerWeek")}
              >
                <input
                  id="settings-weekly-hours"
                  type="number"
                  onWheel={preventWheelOnFocusedNumberInput}
                  value={form.standardWeeklyHours}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (e.target.value !== "" && Number.isFinite(n)) {
                      setField("standardWeeklyHours", n);
                    }
                  }}
                  placeholder={t("components.appPreferences.phWeeklyHours")}
                  className={fieldInputClass}
                  disabled={!canWrite}
                />
              </SettingsField>
              <SettingsField
                id="settings-monthly-hours"
                label={t("components.appPreferences.lblWorkDaysPerMonth")}
                hint={t("components.appPreferences.hintWorkDaysPerMonth")}
              >
                <input
                  id="settings-monthly-hours"
                  type="number"
                  onWheel={preventWheelOnFocusedNumberInput}
                  value={form.standardMonthlyHours}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (e.target.value !== "" && Number.isFinite(n)) {
                      setField("standardMonthlyHours", n);
                    }
                  }}
                  placeholder={t("components.appPreferences.phMonthlyHours")}
                  className={fieldInputClass}
                  disabled={!canWrite}
                />
              </SettingsField>
            </div>
          </div>

          <div className="rounded-xl border p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Globe2 size={15} className="text-gray-500" />
              {t("components.appPreferences.regionalSection")}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <SettingsField
                id="settings-date-format"
                label={t("components.appPreferences.lblDateFormat")}
                hint={t("components.appPreferences.hintDateFormat")}
              >
                <select
                  id="settings-date-format"
                  value={form.dateFormat}
                  onChange={(e) => setField("dateFormat", e.target.value)}
                  className={fieldInputClass}
                  disabled={!canWrite}
                >
                  <option value="DD.MM.YYYY">DD.MM.YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </SettingsField>
              <SettingsField
                id="settings-language"
                label={t("components.appPreferences.lblLanguage")}
                hint={t("components.appPreferences.hintLanguage")}
              >
                <select
                  id="settings-language"
                  value={form.language}
                  onChange={(e) => setField("language", e.target.value)}
                  className={fieldInputClass}
                  disabled={!canWrite}
                >
                  <option value="ro">
                    {t("components.appPreferences.langRo")}
                  </option>
                  <option value="en">
                    {t("components.appPreferences.langEn")}
                  </option>
                </select>
              </SettingsField>
              <SettingsField
                id="settings-timezone"
                label={t("components.appPreferences.lblTimezone")}
                hint={t("components.appPreferences.hintTimezone")}
              >
                <input
                  id="settings-timezone"
                  value={form.timezone}
                  onChange={(e) => setField("timezone", e.target.value)}
                  className={fieldInputClass}
                  placeholder={t("components.appPreferences.phTimezone")}
                  disabled={!canWrite}
                />
              </SettingsField>
            </div>
          </div>

          <div className="rounded-xl border p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Bell size={15} className="text-gray-500" />
              {t("components.appPreferences.notifSection")}
            </h3>
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-4">
                <SettingsField
                  id="settings-doc-alert-days"
                  label={t("components.appPreferences.lblContractExpiryDays")}
                  hint={t("components.appPreferences.hintContractExpiryDays")}
                >
                  <div className="flex max-w-sm items-center gap-2">
                    <input
                      id="settings-doc-alert-days"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      onWheel={preventWheelOnFocusedNumberInput}
                      value={form.alertExpiredDocumentsDays}
                      onChange={(e) => {
                        const n = Number.parseInt(e.target.value, 10);
                        if (e.target.value !== "" && Number.isFinite(n) && n >= 0) {
                          setField("alertExpiredDocumentsDays", n);
                        }
                      }}
                      placeholder={t("components.appPreferences.phDocAlert")}
                      className={fieldInputClass}
                      disabled={!canWrite}
                    />
                    <span className="shrink-0 text-sm font-medium text-gray-600">
                      {t("components.appPreferences.unitDays")}
                    </span>
                  </div>
                </SettingsField>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-4">
                <SettingsField
                  id="settings-deployment-alert-days"
                  label={t("components.appPreferences.lblAttendanceReminderDays")}
                  hint={t("components.appPreferences.hintAttendanceReminderDays")}
                >
                  <div className="flex max-w-sm items-center gap-2">
                    <input
                      id="settings-deployment-alert-days"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      onWheel={preventWheelOnFocusedNumberInput}
                      value={form.alertExpiringDeploymentsDays}
                      onChange={(e) => {
                        const n = Number.parseInt(e.target.value, 10);
                        if (e.target.value !== "" && Number.isFinite(n) && n >= 0) {
                          setField("alertExpiringDeploymentsDays", n);
                        }
                      }}
                      placeholder={t("components.appPreferences.phDeploymentAlert")}
                      className={fieldInputClass}
                      disabled={!canWrite}
                    />
                    <span className="shrink-0 text-sm font-medium text-gray-600">
                      {t("components.appPreferences.unitDays")}
                    </span>
                  </div>
                </SettingsField>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-4">
                <label
                  htmlFor="settings-in-app-notifications"
                  className="flex cursor-pointer items-start gap-3"
                >
                  <input
                    id="settings-in-app-notifications"
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.inAppNotificationsEnabled}
                    onChange={(e) =>
                      setField("inAppNotificationsEnabled", e.target.checked)
                    }
                    disabled={!canWrite}
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">
                      {t("components.appPreferences.lblInAppNotifications")}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-gray-500">
                      {t("components.appPreferences.hintInAppNotifications")}
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-xl border p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Database size={15} className="text-gray-500" />
              {t("components.appPreferences.backupSection")}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDatabaseExport}
                disabled={!canWrite}
                className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                {t("components.appPreferences.exportDb")}
              </button>
              <input
                ref={dbInputRef}
                type="file"
                accept=".db"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleDatabaseImport(file);
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (canWrite) dbInputRef.current?.click();
                }}
                disabled={importingDb || !canWrite}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
              >
                {importingDb
                  ? t("components.appPreferences.importing")
                  : t("components.appPreferences.importDb")}
              </button>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              {t("components.appPreferences.dbLocation")}{" "}
              {dbPath || "prisma/dev.db"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
