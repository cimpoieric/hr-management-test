"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Settings,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Eye,
  Clock,
  Inbox,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { tImportStatus } from "@/messages";

interface CronStatus {
  running: boolean;
  lastRunAt: string | null;
  totalProcessedToday: number;
  lastError: string | null;
  intervalMinutes: number;
}

interface EmailImport {
  id: number;
  subject: string;
  fromAddress: string;
  receivedAt: string;
  attachments: number;
  processed: number;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface PageData {
  cron: CronStatus;
  todayCount: number;
  pendingImports: { pending: number; total: number };
  recentEmails: EmailImport[];
}

export default function ImportEmailPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState({
    host: "",
    port: 993,
    user: "",
    password: "",
    tls: true,
    cronMinutes: 15,
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/import/email/status");
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 30_000); // refresh la 30s
    return () => clearInterval(timer);
  }, [fetchData]);

  async function handleTrigger() {
    setTriggering(true);
    try {
      const res = await fetch("/api/import/email/trigger", { method: "POST" });
      const result = await res.json();
      if (res.ok) {
        alert(`Procesate: ${result.processed} emailuri, ${result.created} importuri create`);
      } else {
        alert(result.error ?? "Eroare");
      }
      fetchData();
    } catch {
      alert("Eroare de rețea");
    } finally {
      setTriggering(false);
    }
  }

  async function fetchConfig() {
    setConfigLoading(true);
    try {
      const res = await fetch("/api/import/email/config");
      if (res.ok) {
        const d = await res.json();
        setConfig((prev) => ({ ...prev, ...d, password: "" }));
      }
    } catch {
      // silent
    } finally {
      setConfigLoading(false);
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSaveMessage("");
    try {
      const res = await fetch("/api/import/email/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const d = await res.json();
      if (res.ok) {
        setSaveMessage("Configurație salvată cu succes");
        setConfig((prev) => ({ ...prev, password: "" }));
      } else {
        setSaveMessage(d.error ?? "Eroare la salvare");
      }
    } catch {
      setSaveMessage("Eroare de rețea");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const cron = data?.cron;
  const lastRunFormatted = cron?.lastRunAt
    ? new Date(cron.lastRunAt).toLocaleString("ro-RO")
    : "Niciodată";

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Email IMAP</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configurare și monitorizare import automat din email
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowConfig(!showConfig);
              if (!showConfig) fetchConfig();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Settings size={16} />
            Configurare
          </button>
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {triggering ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Verifică acum
          </button>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          icon={Clock}
          label="Ultima verificare"
          value={lastRunFormatted}
          color="text-gray-600"
        />
        <StatusCard
          icon={Inbox}
          label="Emailuri azi"
          value={String(data?.todayCount ?? 0)}
          color="text-blue-600"
        />
        <StatusCard
          icon={FileText}
          label="Importuri în așteptare"
          value={`${data?.pendingImports.pending ?? 0} / ${data?.pendingImports.total ?? 0}`}
          color="text-amber-600"
        />
        <StatusCard
          icon={cron?.running ? CheckCircle2 : AlertCircle}
          label="Status cron"
          value={cron?.running ? "Activ" : "Oprit"}
          color={cron?.running ? "text-green-600" : "text-red-600"}
        />
      </div>

      {/* Config panel */}
      {showConfig && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Configurare IMAP</h2>
          <form onSubmit={handleSaveConfig} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Server IMAP *
              </label>
              <input
                type="text"
                value={config.host}
                onChange={(e) => setConfig((c) => ({ ...c, host: e.target.value }))}
                placeholder="imap.gmail.com"
                className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Port
                </label>
                <input
                  type="number"
                  value={config.port}
                  onChange={(e) => setConfig((c) => ({ ...c, port: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  TLS
                </label>
                <select
                  value={String(config.tls)}
                  onChange={(e) => setConfig((c) => ({ ...c, tls: e.target.value === "true" }))}
                  className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                >
                  <option value="true">Activat</option>
                  <option value="false">Dezactivat</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Utilizator *
              </label>
              <input
                type="text"
                value={config.user}
                onChange={(e) => setConfig((c) => ({ ...c, user: e.target.value }))}
                placeholder="documente@firma.ro"
                className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parolă (lasă gol pentru a păstra actuala)
              </label>
              <input
                type="password"
                value={config.password}
                onChange={(e) => setConfig((c) => ({ ...c, password: e.target.value }))}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Frecvență (minute)
              </label>
              <input
                type="number"
                min={5}
                max={1440}
                value={config.cronMinutes}
                onChange={(e) => setConfig((c) => ({ ...c, cronMinutes: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                <Save size={16} />
                Salvează
              </button>
              {saveMessage && (
                <span className={`text-sm ${saveMessage.includes("succes") ? "text-green-600" : "text-red-600"}`}>
                  {saveMessage}
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Recent emails table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Mail size={16} />
            Emailuri procesate recent
          </h3>
          <span className="text-xs text-gray-400">
            Ultimele {data?.recentEmails.length ?? 0}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Subiect</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">De la</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Data</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Ataș.</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Importuri</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {(!data?.recentEmails || data.recentEmails.length === 0) ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    <Mail size={48} className="mx-auto mb-4 text-gray-300" />
                    Niciun email procesat încă
                  </td>
                </tr>
              ) : (
                data.recentEmails.map((email) => (
                  <tr key={email.id} className="border-b last:border-b-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                      {email.subject}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{email.fromAddress}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(email.createdAt).toLocaleDateString("ro-RO")}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{email.attachments}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{email.processed}</td>
                    <td className="px-4 py-3">
                      <EmailStatusBadge status={email.status} error={email.errorMessage} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Link către queue */}
      <div className="text-center">
        <Link
          href="/importuri"
          className="inline-flex items-center gap-2 text-sm text-slate-900 hover:underline font-medium"
        >
          <Eye size={16} />
          Vezi toate importurile în așteptare
        </Link>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className="text-gray-400" />
        <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function EmailStatusBadge({ status, error }: { status: string; error: string | null }) {
  if (status === "PROCESSED") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
        <CheckCircle2 size={12} />
        OK
      </span>
    );
  }
  if (status === "ERROR") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-700"
        title={error ?? ""}
      >
        <AlertTriangle size={12} />
        Eroare
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600">
      <Clock size={12} />
      {tImportStatus("PENDING")}
    </span>
  );
}
