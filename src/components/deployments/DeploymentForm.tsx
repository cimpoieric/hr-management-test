"use client";

import { useTranslation } from "@/hooks/useTranslation";
import {
  DEPLOYMENT_COUNTRIES,
  DEPLOYMENT_STATUSES,
  getCountryLabel,
} from "@/lib/countries";
import { AlertCircle, Globe, Save, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface DeploymentFormProps {
  employeeId: number;
  employeeName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function DeploymentForm({
  employeeId,
  employeeName,
  onSuccess,
  onCancel,
}: DeploymentFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    country: "NL",
    city: "",
    startDate: "",
    endDate: "",
    status: "ACTIVE" as string,
    notes: "",
  });

  useEffect(() => {
    setForm((prev) =>
      prev.startDate
        ? prev
        : {
            ...prev,
            startDate: new Date().toISOString().split("T")[0] ?? "",
          },
    );
  }, []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);

  const update = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const n = { ...prev };
      delete n[field];
      return n;
    });
    setOverlapWarning(null);
  }, []);

  function statusLabel(code: string): string {
    const k = `pages.deployments.status.${code}`;
    const label = t(k);
    return label === k ? code : label;
  }

  function validate(): boolean {
    const e: Record<string, string> = {};

    if (!form.startDate)
      e.startDate = t("components.deployments.form.valStartRequired");
    if (form.endDate && form.startDate && form.endDate <= form.startDate) {
      e.endDate = t("components.deployments.form.valEndAfterStart");
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    setOverlapWarning(null);

    try {
      const payload = {
        employeeId,
        country: form.country,
        city: form.city.trim() || null,
        startDate: form.startDate,
        endDate: form.endDate || null,
        status: form.status,
        notes: form.notes.trim() || null,
      };

      const res = await fetch("/api/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 409 && data.error === "OVERLAP") {
        setOverlapWarning(data.message);
        setSaving(false);
        return;
      }

      if (!res.ok) {
        setErrors({
          submit:
            typeof data.error === "string"
              ? data.error
              : t("components.deployments.form.saveFailed"),
        });
        setSaving(false);
        return;
      }

      onSuccess?.();
    } catch {
      setErrors({ submit: t("components.toast.networkError") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b">
        <Globe size={18} className="text-gray-400" />
        <h3 className="font-semibold text-gray-900">
          {t("components.deployments.form.newTitle", {
            emDash: t("common.emDash"),
            name: employeeName,
          })}
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("components.deployments.form.countryLabel")}
          </label>
          <select
            value={form.country}
            onChange={(e) => update("country", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
          >
            {DEPLOYMENT_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {getCountryLabel(c.code)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("components.deployments.form.cityLabel")}
          </label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
            placeholder={t("components.deployments.form.cityPlaceholder")}
            className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("components.deployments.form.startDateLabel")}
          </label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => update("startDate", e.target.value)}
            className={`w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950 ${
              errors.startDate ? "border-red-300" : ""
            }`}
          />
          {errors.startDate && (
            <p className="text-xs text-red-600 mt-1">{errors.startDate}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("components.deployments.form.endDateLabel")}
          </label>
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => update("endDate", e.target.value)}
            className={`w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950 ${
              errors.endDate ? "border-red-300" : ""
            }`}
          />
          {errors.endDate && (
            <p className="text-xs text-red-600 mt-1">{errors.endDate}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("components.deployments.form.statusLabel")}
          </label>
          <select
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
          >
            {DEPLOYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("components.deployments.form.notesLabel")}
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder={t("components.deployments.form.notesPlaceholder")}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950 resize-none"
          />
        </div>
      </div>

      {overlapWarning && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {overlapWarning}
        </div>
      )}

      {errors.submit && <p className="text-sm text-red-600">{errors.submit}</p>}

      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <X size={16} />
            {t("common.cancel")}
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          <Save size={16} />
          {saving
            ? t("components.deployments.form.saving")
            : t("components.deployments.form.save")}
        </button>
      </div>
    </div>
  );
}
