"use client";

import { useTranslation } from "@/hooks/useTranslation";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";

type CountryRow = {
  id: number;
  name: string;
  code: string;
  phoneCode: string | null;
  _count: { employees: number; companies: number };
};

export default function SetariTariPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<CountryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CountryRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    phoneCode: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/settings/countries", { cache: "no-store" });
      if (!res.ok) throw new Error(t("pages.settingsCountries.errorLoad"));
      const data = await res.json();
      setRows(data.countries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("pages.settingsCountries.errorGeneric"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", code: "", phoneCode: "" });
    setModalOpen(true);
  }

  function openEdit(c: CountryRow) {
    setEditing(c);
    setForm({
      name: c.name,
      code: c.code,
      phoneCode: c.phoneCode ?? "",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const body = {
        name: form.name.trim(),
        code: form.code.trim(),
        phoneCode: form.phoneCode.trim() || null,
      };
      const url = editing
        ? `/api/settings/countries/${editing.id}`
        : "/api/settings/countries";
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("pages.settingsCountries.errorSave"));
        return;
      }
      setModalOpen(false);
      await load();
    } catch {
      setError(t("pages.settingsCountries.errorNetwork"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: CountryRow) {
    if (!confirm(t("pages.settingsCountries.confirmDelete", { name: c.name })))
      return;
    setError("");
    try {
      const res = await fetch(`/api/settings/countries/${c.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("pages.settingsCountries.errorDelete"));
        return;
      }
      await load();
    } catch {
      setError(t("pages.settingsCountries.errorNetwork"));
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href={ROUTES.settings}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-2"
        >
          <ArrowLeft size={16} />
          {t("pages.settingsCountries.backToSettings")}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("pages.settingsCountries.title")}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t("pages.settingsCountries.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
          >
            <Plus size={16} />
            {t("pages.settingsCountries.addCountry")}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">
                  {t("pages.settingsCountries.colName")}
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  {t("pages.settingsCountries.colIso")}
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  {t("pages.settingsCountries.colPhone")}
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  {t("pages.settingsCountries.colUsage")}
                </th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">
                  {t("pages.settingsCountries.colActions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    {t("pages.settingsCountries.loading")}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    {t("pages.settingsCountries.empty")}
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {c.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600">
                      {c.code}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.phoneCode ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {t("pages.settingsCountries.usageCounts", {
                        employees: c._count.employees,
                        companies: c._count.companies,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-gray-600 hover:bg-gray-100"
                        title={t("pages.settingsCountries.editTooltip")}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(c)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-red-600 hover:bg-red-50"
                        title={t("pages.settingsCountries.deleteTooltip")}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border bg-white shadow-xl">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing
                  ? t("pages.settingsCountries.modalEditTitle")
                  : t("pages.settingsCountries.modalCreateTitle")}
              </h2>
            </div>
            <div className="px-6 py-4 space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                {t("pages.settingsCountries.fieldName")}
              </label>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
              <label className="block text-sm font-medium text-gray-700">
                {t("pages.settingsCountries.fieldIso")}
              </label>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm uppercase font-mono"
                maxLength={3}
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                }
              />
              <label className="block text-sm font-medium text-gray-700">
                {t("pages.settingsCountries.fieldPhoneCode")}
              </label>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder={t("pages.settingsCountries.phonePlaceholder")}
                value={form.phoneCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phoneCode: e.target.value }))
                }
              />
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-white"
              >
                {t("pages.settingsCountries.cancel")}
              </button>
              <button
                type="button"
                disabled={
                  saving || !form.name.trim() || form.code.trim().length < 2
                }
                onClick={() => void handleSave()}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                {saving
                  ? t("pages.settingsCountries.saving")
                  : t("pages.settingsCountries.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
