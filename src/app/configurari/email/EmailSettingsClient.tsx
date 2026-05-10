"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Save, PlugZap, Info } from "lucide-react";
import { useForm } from "react-hook-form";

type SmtpConfigResponse = {
  host: string;
  port: number;
  user: string;
  hasPassword: boolean;
  fromEmail: string;
  fromName: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
};

type EmailSettingsForm = {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
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
  const [error, setError] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState(false);

  const defaultValues = useMemo<EmailSettingsForm>(
    () => ({
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      smtpUser: "",
      smtpPass: "",
      fromEmail: "",
      fromName: "HR Management",
      subjectTemplate: "Fluturas salariu - {luna} {an}",
      bodyTemplate: "",
      isActive: true,
    }),
    []
  );

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<EmailSettingsForm>({
    defaultValues,
    mode: "onBlur",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/email/settings", { cache: "no-store", credentials: "same-origin" });
        const data = (await res.json().catch(() => ({}))) as Partial<SmtpConfigResponse> & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Nu am putut încărca setările");
        if (cancelled) return;
        setHasPassword(Boolean(data.hasPassword));
        setValue("smtpHost", String(data.host ?? defaultValues.smtpHost), { shouldDirty: false });
        setValue("smtpPort", Number(data.port ?? defaultValues.smtpPort), { shouldDirty: false });
        setValue("smtpUser", String(data.user ?? ""), { shouldDirty: false });
        setValue("fromEmail", String(data.fromEmail ?? ""), { shouldDirty: false });
        setValue("fromName", String(data.fromName ?? defaultValues.fromName), { shouldDirty: false });
        setValue(
          "subjectTemplate",
          String(data.subjectTemplate ?? defaultValues.subjectTemplate),
          { shouldDirty: false }
        );
        setValue("bodyTemplate", String(data.bodyTemplate ?? ""), { shouldDirty: false });
        setValue("isActive", Boolean(data.isActive ?? true), { shouldDirty: false });
        setValue("smtpPass", "", { shouldDirty: false });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Eroare");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [defaultValues, setValue]);

  const save = handleSubmit(async (data) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/email/settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: data.smtpHost,
          port: Number(data.smtpPort),
          user: data.smtpUser,
          password: data.smtpPass.trim().length > 0 ? data.smtpPass : undefined,
          fromEmail: data.fromEmail,
          fromName: data.fromName,
          subjectTemplate: data.subjectTemplate,
          bodyTemplate: data.bodyTemplate,
          isActive: data.isActive,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Nu am putut salva");
      toast.success("Setari SMTP salvate");
      setValue("smtpPass", "", { shouldDirty: false });
      setHasPassword(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Eroare";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  });

  const test = handleSubmit(async (data) => {
    setTesting(true);
    setError(null);
    try {
      const realTime = data.smtpPass.trim().length > 0;
      const res = await fetch("/api/email/test", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: realTime
          ? JSON.stringify({
              host: data.smtpHost,
              port: Number(data.smtpPort),
              user: data.smtpUser,
              pass: data.smtpPass,
              secure: Number(data.smtpPort) === 465,
            })
          : JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(body.error ?? "Test esuat");
      toast.success(body.message ?? "Conexiune SMTP OK");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Eroare";
      setError(msg);
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  });

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
        <h1 className="text-2xl font-bold text-gray-900">Configurare Email (SMTP)</h1>
        <p className="text-sm text-gray-500 mt-1">
          Setarile pentru trimiterea email-urilor din aplicatie (fluturasi, notificari).
        </p>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-medium">Eroare:</p>
          <p className="text-sm">{error}</p>
        </div>
      ) : null}

      {/* SMTP */}
      <div className="rounded-xl border bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Setari SMTP</h2>
            <p className="mt-1 text-sm text-gray-500">Parola este criptata la salvare.</p>
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
            <label className="text-xs font-medium text-gray-600">SMTP Host</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="smtp.gmail.com"
              {...register("smtpHost", { required: "SMTP Host este obligatoriu" })}
            />
            {errors.smtpHost ? <p className="mt-1 text-red-500 text-sm">{errors.smtpHost.message}</p> : null}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">SMTP Port</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              type="number"
              {...register("smtpPort", {
                valueAsNumber: true,
                required: "SMTP Port este obligatoriu",
                min: { value: 1, message: "SMTP Port este obligatoriu" },
              })}
            />
            {errors.smtpPort ? <p className="mt-1 text-red-500 text-sm">{errors.smtpPort.message}</p> : null}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Utilizator SMTP</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="email@firma.ro"
              {...register("smtpUser", { required: "Utilizator SMTP este obligatoriu" })}
            />
            {errors.smtpUser ? <p className="mt-1 text-red-500 text-sm">{errors.smtpUser.message}</p> : null}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Parola SMTP</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              type="password"
              placeholder={hasPassword ? "•••••••• (setata)" : "—"}
              {...register("smtpPass", {
                validate: (v) => {
                  const s = String(v ?? "").trim();
                  if (s.length > 0) return true;
                  return hasPassword ? true : "Parola SMTP este obligatorie (pentru prima configurare).";
                },
              })}
            />
            <div className="mt-1 text-xs text-gray-500">
              Lasa gol ca sa pastrezi parola existenta.
            </div>
            {errors.smtpPass ? <p className="mt-1 text-red-500 text-sm">{errors.smtpPass.message}</p> : null}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Email expeditor</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="noreply@firma.ro"
              {...register("fromEmail", { required: "Email expeditor este obligatoriu" })}
            />
            {errors.fromEmail ? <p className="mt-1 text-red-500 text-sm">{errors.fromEmail.message}</p> : null}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Nume expeditor</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="HR Manager"
              {...register("fromName", { required: "Nume expeditor este obligatoriu" })}
            />
            {errors.fromName ? <p className="mt-1 text-red-500 text-sm">{errors.fromName.message}</p> : null}
          </div>
          <div className="md:col-span-2">
            <div className="text-xs text-gray-500">
              Tip conexiune: port 465 = SSL, port 587 = TLS (STARTTLS)
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <div className="flex items-start gap-2">
            <Info size={16} className="mt-0.5 shrink-0 text-blue-700" />
            <div className="space-y-2">
              <div className="font-semibold">Configurare Gmail SMTP (App Password)</div>
              <ol className="list-decimal pl-5 space-y-1 text-blue-900">
                <li>
                  Mergi la{" "}
                  <a
                    className="underline underline-offset-2"
                    href="https://myaccount.google.com/security"
                    target="_blank"
                    rel="noreferrer"
                  >
                    https://myaccount.google.com/security
                  </a>
                </li>
                <li>Activeaza "Verificare in 2 pasi"</li>
                <li>
                  Mergi la{" "}
                  <a
                    className="underline underline-offset-2"
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noreferrer"
                  >
                    https://myaccount.google.com/apppasswords
                  </a>
                </li>
                <li>Alege "Mail" → "Alt (denumire personalizata)"</li>
                <li>Scrie "HR Manager" → Click "Generare"</li>
                <li>Copiaza parola de 16 caractere (ex: abcd efgh ijkl mnop)</li>
                <li>Introdu parola aici, in campul "Parola SMTP"</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Template */}
      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">Template email (default)</h2>
        <div className="mt-4 grid grid-cols-1 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600">Subiect default (template)</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder='Fluturas salariu - {luna} {an}'
              {...register("subjectTemplate")}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Mesaj default (template)</label>
            <textarea
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              rows={8}
              placeholder="Text standard"
              {...register("bodyTemplate")}
            />
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <span className="inline-flex items-center gap-2">
            <Check size={14} />
            Template-ul se salveaza in EmailSettings si va fi folosit la trimiterea fluturasilor.
          </span>
        </div>
      </div>
    </div>
  );
}

