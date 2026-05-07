"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Save, PlugZap } from "lucide-react";

type SmtpConfigResponse = {
  host: string;
  port: number;
  user: string;
  hasPassword: boolean;
  fromEmail: string;
  fromName: string;
  secure: boolean;
  payslipTemplate: string;
};

const VARS = [
  "{{nume}}",
  "{{saptamana}}",
  "{{an}}",
  "{{perioadaStart}}",
  "{{perioadaEnd}}",
  "{{oreLucrate}}",
  "{{salariuNet}}",
  "{{travelAllowance}}",
  "{{totalPlatit}}",
];

export default function EmailSettingsClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [form, setForm] = useState({
    host: "",
    port: 587,
    user: "",
    password: "",
    fromEmail: "",
    fromName: "HR Management",
    secure: false,
    payslipTemplate:
      "Bună {{nume}},\n\nAtașat găsești fluturașul de salariu pentru săptămâna {{saptamana}}/{{an}}.\n" +
      "Perioada: {{perioadaStart}} - {{perioadaEnd}}\n\n" +
      "Ore lucrate: {{oreLucrate}}\n" +
      "Salariu net: {{salariuNet}}\n" +
      "Travel allowance: {{travelAllowance}}\n" +
      "Total plătit: {{totalPlatit}}\n\n" +
      "O zi bună,\n{{fromName}}\n",
    hasPassword: false,
  });

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/email/config", { cache: "no-store", credentials: "include" });
        const data = (await res.json().catch(() => ({}))) as Partial<SmtpConfigResponse> & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Nu am putut încărca setările");
        if (cancelled) return;
        setForm((p) => ({
          ...p,
          host: String(data.host ?? ""),
          port: Number(data.port ?? 587),
          user: String(data.user ?? ""),
          fromEmail: String(data.fromEmail ?? ""),
          fromName: String(data.fromName ?? "HR Management"),
          secure: Boolean(data.secure),
          payslipTemplate: String(data.payslipTemplate ?? p.payslipTemplate),
          hasPassword: Boolean(data.hasPassword),
          password: "",
        }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Eroare");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/email/config", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: form.host,
          port: form.port,
          user: form.user,
          password: form.password.trim().length > 0 ? form.password : undefined,
          fromEmail: form.fromEmail,
          fromName: form.fromName,
          secure: form.secure,
          payslipTemplate: form.payslipTemplate,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Nu am putut salva");
      toast.success("Setări SMTP salvate");
      setField("password", "");
      setField("hasPassword", true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      const res = await fetch("/api/email/test", { method: "POST", credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? "Test eșuat");
      toast.success(data.message ?? "Conexiune SMTP OK");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="animate-spin" size={16} />
          Se încarcă...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurări Email</h1>
        <p className="text-sm text-gray-500 mt-1">Setări SMTP + template email fluturaș</p>
      </div>

      {/* SMTP */}
      <div className="rounded-xl border bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Setări SMTP</h2>
            <p className="mt-1 text-sm text-gray-500">Parola este criptată la salvare.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={test}
              disabled={testing || saving}
              className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                {testing ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />}
                Testează conexiunea
              </span>
            </button>
            <button
              onClick={save}
              disabled={saving || testing}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Salvează
              </span>
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-gray-600">Host</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="smtp.gmail.com"
              value={form.host}
              onChange={(e) => setField("host", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Port</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              type="number"
              value={form.port}
              onChange={(e) => setField("port", Number(e.target.value || "587"))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Username / Email</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={form.user}
              onChange={(e) => setField("user", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Password</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              type="password"
              placeholder={form.hasPassword ? "•••••••• (setată)" : "—"}
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
            />
            <div className="mt-1 text-xs text-gray-500">
              Lasă gol ca să păstrezi parola existentă.
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">From Email</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={form.fromEmail}
              onChange={(e) => setField("fromEmail", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">From Name</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={form.fromName}
              onChange={(e) => setField("fromName", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.secure}
                onChange={(e) => setField("secure", e.target.checked)}
              />
              Secure (TLS/SSL)
            </label>
          </div>
        </div>
      </div>

      {/* Template */}
      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">Template email fluturaș</h2>
        <p className="mt-1 text-sm text-gray-500">
          Variabile disponibile:{" "}
          <span className="font-mono text-xs text-gray-700">{VARS.join(", ")}</span>
        </p>

        <textarea
          className="mt-4 w-full rounded-lg border px-3 py-2 text-sm font-mono"
          rows={10}
          value={form.payslipTemplate}
          onChange={(e) => setField("payslipTemplate", e.target.value)}
        />

        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <span className="inline-flex items-center gap-2">
            <Check size={14} />
            Template-ul se salvează în SystemConfig și va fi folosit la trimiterea fluturașilor.
          </span>
        </div>
      </div>
    </div>
  );
}

