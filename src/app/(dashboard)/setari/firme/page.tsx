"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";

type CompanyRow = {
  id: number;
  name: string;
  taxCode: string | null;
  address: string | null;
  status: string;
  country: { id: number; name: string; code: string } | null;
  _count: { employees: number };
};

type CountryOpt = { id: number; name: string; code: string };

export default function SetariFirmePage() {
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [countries, setCountries] = useState<CountryOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    taxCode: "",
    address: "",
    countryId: "",
    status: "Activ" as "Activ" | "Inactiv",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cRes, ctRes] = await Promise.all([
        fetch("/api/settings/companies", { cache: "no-store" }),
        fetch("/api/countries", { cache: "no-store" }),
      ]);
      if (!cRes.ok) throw new Error("Nu am putut încărca firmele");
      if (!ctRes.ok) throw new Error("Nu am putut încărca țările");
      const cData = await cRes.json();
      const ctData = await ctRes.json();
      setRows(cData.companies ?? []);
      setCountries(ctData.countries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      taxCode: "",
      address: "",
      countryId: "",
      status: "Activ",
    });
    setModalOpen(true);
  }

  function openEdit(c: CompanyRow) {
    setEditing(c);
    setForm({
      name: c.name,
      taxCode: c.taxCode ?? "",
      address: c.address ?? "",
      countryId: c.country ? String(c.country.id) : "",
      status: c.status === "Inactiv" ? "Inactiv" : "Activ",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const body = {
        name: form.name.trim(),
        taxCode: form.taxCode.trim() || null,
        address: form.address.trim() || null,
        countryId:
          form.countryId === "" ? null : parseInt(form.countryId, 10),
        status: form.status,
      };
      const url = editing
        ? `/api/settings/companies/${editing.id}`
        : "/api/settings/companies";
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Eroare la salvare");
        return;
      }
      setModalOpen(false);
      await load();
    } catch {
      setError("Eroare de rețea");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: CompanyRow) {
    if (!confirm(`Ștergi firma „${c.name}”?`)) return;
    setError("");
    try {
      const res = await fetch(`/api/settings/companies/${c.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Nu s-a putut șterge");
        return;
      }
      await load();
    } catch {
      setError("Eroare de rețea");
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link
          href="/setari"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-2"
        >
          <ArrowLeft size={16} />
          Înapoi la setări
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Firme</h1>
            <p className="text-sm text-gray-500 mt-1">Administrare firme angajatoare</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
          >
            <Plus size={16} />
            Adaugă firmă
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
                <th className="px-4 py-3 font-medium text-gray-600">Nume</th>
                <th className="px-4 py-3 font-medium text-gray-600">Cod fiscal</th>
                <th className="px-4 py-3 font-medium text-gray-600">Țară (sediu)</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">Angajați</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    Se încarcă...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    Nicio firmă
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-gray-600">{c.taxCode ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.country ? `${c.country.name} (${c.country.code})` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          c.status === "Activ"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c._count.employees}</td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-gray-600 hover:bg-gray-100"
                        title="Editează"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(c)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-red-600 hover:bg-red-50"
                        title="Șterge"
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
                {editing ? "Editează firmă" : "Firmă nouă"}
              </h2>
            </div>
            <div className="px-6 py-4 space-y-3">
              <label className="block text-sm font-medium text-gray-700">Nume *</label>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <label className="block text-sm font-medium text-gray-700">Cod fiscal</label>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={form.taxCode}
                onChange={(e) => setForm((f) => ({ ...f, taxCode: e.target.value }))}
              />
              <label className="block text-sm font-medium text-gray-700">Adresă</label>
              <textarea
                className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
                rows={2}
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
              <label className="block text-sm font-medium text-gray-700">Țară (sediu)</label>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={form.countryId}
                onChange={(e) => setForm((f) => ({ ...f, countryId: e.target.value }))}
              >
                <option value="">—</option>
                {countries.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({x.code})
                  </option>
                ))}
              </select>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as "Activ" | "Inactiv",
                  }))
                }
              >
                <option value="Activ">Activ</option>
                <option value="Inactiv">Inactiv</option>
              </select>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-white"
              >
                Anulează
              </button>
              <button
                type="button"
                disabled={saving || !form.name.trim()}
                onClick={() => void handleSave()}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Se salvează..." : "Salvează"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
