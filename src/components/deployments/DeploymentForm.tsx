"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Save, X, AlertCircle, Globe } from "lucide-react";
import {
  DEPLOYMENT_COUNTRIES,
  DEPLOYMENT_STATUSES,
  getCountryLabel,
} from "@/lib/countries";

interface DeploymentFormProps {
  employeeId: number;
  employeeName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planificată",
  ACTIVE: "Activă",
  COMPLETED: "Finalizată",
  CANCELLED: "Anulată",
};

export function DeploymentForm({
  employeeId,
  employeeName,
  onSuccess,
  onCancel,
}: DeploymentFormProps) {
  const [form, setForm] = useState({
    country: "NL",
    city: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    status: "ACTIVE" as string,
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);

  const update = useCallback(
    (field: string, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        const n = { ...prev };
        delete n[field];
        return n;
      });
      setOverlapWarning(null);
    },
    []
  );

  function validate(): boolean {
    const e: Record<string, string> = {};

    if (!form.startDate) e.startDate = "Data de început este obligatorie";
    if (form.endDate && form.startDate && form.endDate <= form.startDate) {
      e.endDate = "Data de sfârșit trebuie să fie după data de început";
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
        setErrors({ submit: data.error ?? "Eroare la salvare" });
        setSaving(false);
        return;
      }

      onSuccess?.();
    } catch {
      setErrors({ submit: "Eroare de rețea" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b">
        <Globe size={18} className="text-gray-400" />
        <h3 className="font-semibold text-gray-900">
          Detașare nouă — {employeeName}
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Țară */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Țară *
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

        {/* Oraș */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Oraș
          </label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
            placeholder="Amsterdam"
            className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
          />
        </div>

        {/* Start date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Data început *
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

        {/* End date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Data sfârșit (lasă gol dacă în desfășurare)
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

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
          >
            {DEPLOYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s] ?? s}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observații
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Note despre detașare..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950 resize-none"
          />
        </div>
      </div>

      {/* Overlap warning */}
      {overlapWarning && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {overlapWarning}
        </div>
      )}

      {errors.submit && (
        <p className="text-sm text-red-600">{errors.submit}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <X size={16} />
            Anulează
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          <Save size={16} />
          {saving ? "Se salvează..." : "Salvează detașarea"}
        </button>
      </div>
    </div>
  );
}
