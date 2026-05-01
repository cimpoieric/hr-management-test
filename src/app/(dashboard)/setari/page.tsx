"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Settings,
  Upload,
  Image,
  AlertCircle,
  Check,
  Loader2,
  Trash2,
  Info,
  Building2,
  Wallet,
  Globe2,
  Bell,
  Database,
} from "lucide-react";

export default function SetariPage() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [logoExists, setLogoExists] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [dbPath, setDbPath] = useState("");
  const [importingDb, setImportingDb] = useState(false);
  const dbInputRef = useRef<HTMLInputElement>(null);
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
    language: "ro",
    timezone: "Europe/Bucharest",
    alertExpiredDocumentsDays: 30,
    alertExpiringDeploymentsDays: 7,
    inAppNotificationsEnabled: true,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if logo exists
  const checkLogo = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/logo");
      if (res.ok) {
        const data = await res.json();
        setLogoExists(data.exists);
        if (data.exists && data.url) {
          setLogoUrl(data.url);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    checkLogo();
  }, [checkLogo]);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed"))))
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
          language: data.language ?? "ro",
          timezone: data.timezone ?? "Europe/Bucharest",
          alertExpiredDocumentsDays: Number(data.alertExpiredDocumentsDays ?? 30),
          alertExpiringDeploymentsDays: Number(data.alertExpiringDeploymentsDays ?? 7),
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
        setError(data.error ?? "Nu am putut salva setările.");
        return;
      }
      setMessage("Setările au fost salvate.");
    } catch {
      setError("Nu am putut salva setările.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setMessage("");
    setError("");

    try {
      // Validate
      if (!file.type.startsWith("image/")) {
        setError("Fișierul trebuie să fie imagine (PNG, JPG)");
        setUploading(false);
        return;
      }
      if (file.size > 500 * 1024) {
        setError("Dimensiune maximă: 500KB");
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append("logo", file);

      const res = await fetch("/api/settings/logo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Eroare la upload");
        setUploading(false);
        return;
      }

      setMessage("Logo încărcat cu succes!");
      checkLogo();
    } catch {
      setError("Eroare la upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Ești sigur că vrei să ștergi logo-ul?")) return;

    try {
      const res = await fetch("/api/settings/logo", { method: "DELETE" });
      if (res.ok) {
        setMessage("Logo șters");
        setLogoExists(false);
        setLogoUrl(null);
      } else {
        setError("Eroare la ștergere");
      }
    } catch {
      setError("Eroare la ștergere");
    }
  }

  async function handleDatabaseExport() {
    try {
      const res = await fetch("/api/settings/database-export");
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Export DB eșuat.");
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
      setError("Export DB eșuat.");
    }
  }

  async function handleDatabaseImport(file: File) {
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
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import DB eșuat.");
        return;
      }
      setMessage(data.warning ?? "Import DB finalizat.");
    } catch {
      setError("Import DB eșuat.");
    } finally {
      setImportingDb(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Setări</h1>
          <p className="text-sm text-gray-500">
            Configurare sistem — logo, parametri, notificări
          </p>
        </div>
      </div>

      {/* Logo Settings */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Image size={18} className="text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Logo firmă</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Logo-ul apare în header-ul tuturor rapoartelor PDF generate.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Preview current logo */}
          {logoExists && logoUrl && (
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <img
                src={logoUrl}
                alt="Logo curent"
                className="h-16 object-contain"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Logo curent</p>
                <p className="text-xs text-gray-500">
                  Acest logo va apărea în toate rapoartele PDF.
                </p>
              </div>
              <button
                onClick={handleDelete}
                className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                title="Șterge logo"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}

          {/* Upload area */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-300 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
              className="hidden"
            />

            {uploading ? (
              <Loader2 size={32} className="mx-auto text-blue-500 animate-spin mb-3" />
            ) : (
              <Upload size={32} className="mx-auto text-gray-300 mb-3" />
            )}

            <p className="text-sm font-medium text-gray-700">
              {uploading ? "Se încarcă..." : "Click sau drag & drop pentru upload"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              PNG sau JPG, maxim 500KB, recomandat 200x60px
            </p>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg p-3">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>
              Dacă nu este setat un logo, rapoartele vor afișa textul "HR Manager"
              în header. Logo-ul este stocat local și nu părăsește serverul.
            </p>
          </div>

          {/* Messages */}
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

      {/* Report Settings */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-6 py-4 border-b flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Setări generale aplicație</h2>
          </div>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Salvează setări
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-xl border p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Building2 size={15} className="text-gray-500" />
              Date companie
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input value={form.companyName} onChange={(e) => setField("companyName", e.target.value)} placeholder="Nume firmă" className="rounded-lg border px-3 py-2 text-sm" />
              <input value={form.companyCuiReg} onChange={(e) => setField("companyCuiReg", e.target.value)} placeholder="CUI / Reg. Com." className="rounded-lg border px-3 py-2 text-sm" />
              <input value={form.legalRepName} onChange={(e) => setField("legalRepName", e.target.value)} placeholder="Reprezentant legal (nume)" className="rounded-lg border px-3 py-2 text-sm" />
              <input value={form.legalRepRole} onChange={(e) => setField("legalRepRole", e.target.value)} placeholder="Reprezentant legal (funcție)" className="rounded-lg border px-3 py-2 text-sm" />
              <input value={form.companyIban} onChange={(e) => setField("companyIban", e.target.value.toUpperCase())} placeholder="IBAN firmă" className="rounded-lg border px-3 py-2 text-sm" />
              <input value={form.companyBank} onChange={(e) => setField("companyBank", e.target.value)} placeholder="Bancă firmă" className="rounded-lg border px-3 py-2 text-sm" />
              <textarea value={form.companyAddress} onChange={(e) => setField("companyAddress", e.target.value)} placeholder="Adresă sediu" className="rounded-lg border px-3 py-2 text-sm sm:col-span-2" rows={2} />
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Wallet size={15} className="text-gray-500" />
              Setări salariale default
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select value={form.salaryDefaultCurrency} onChange={(e) => setField("salaryDefaultCurrency", e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                <option value="RON">RON</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
              <select value={form.salaryDefaultType} onChange={(e) => setField("salaryDefaultType", e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                <option value="LUNAR">Lunar</option>
                <option value="SAPTAMANAL">Săptămânal</option>
                <option value="ORA">Pe oră</option>
              </select>
              <input type="number" value={form.standardMonthlyHours} onChange={(e) => setField("standardMonthlyHours", Number(e.target.value || 0))} placeholder="Ore standard/lună" className="rounded-lg border px-3 py-2 text-sm" />
              <input type="number" value={form.standardWeeklyHours} onChange={(e) => setField("standardWeeklyHours", Number(e.target.value || 0))} placeholder="Ore standard/săptămână" className="rounded-lg border px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Globe2 size={15} className="text-gray-500" />
              Format dată și regional
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <select value={form.dateFormat} onChange={(e) => setField("dateFormat", e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                <option value="DD.MM.YYYY">DD.MM.YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
              <select value={form.language} onChange={(e) => setField("language", e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                <option value="ro">Română</option>
                <option value="en">English</option>
              </select>
              <input value={form.timezone} onChange={(e) => setField("timezone", e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="Europe/Bucharest" />
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Bell size={15} className="text-gray-500" />
              Setări notificări
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input type="number" value={form.alertExpiredDocumentsDays} onChange={(e) => setField("alertExpiredDocumentsDays", Number(e.target.value || 0))} placeholder="Alertă documente expirate (zile)" className="rounded-lg border px-3 py-2 text-sm" />
              <input type="number" value={form.alertExpiringDeploymentsDays} onChange={(e) => setField("alertExpiringDeploymentsDays", Number(e.target.value || 0))} placeholder="Alertă detașări (zile)" className="rounded-lg border px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.inAppNotificationsEnabled} onChange={(e) => setField("inAppNotificationsEnabled", e.target.checked)} />
                Notificări în aplicație
              </label>
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Database size={15} className="text-gray-500" />
              Backup și mentenanță
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDatabaseExport}
                className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Export bază de date
              </button>
              <input
                ref={dbInputRef}
                type="file"
                accept=".db"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleDatabaseImport(file);
                }}
              />
              <button
                type="button"
                onClick={() => dbInputRef.current?.click()}
                disabled={importingDb}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
              >
                {importingDb ? "Se importă..." : "Import bază de date"}
              </button>
            </div>
            <p className="mt-3 text-xs text-gray-500">Locație DB: {dbPath || "prisma/dev.db"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
