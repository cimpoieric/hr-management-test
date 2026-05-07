"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";

const STEPS = ["Cont Admin", "Firmă", "Email SMTP", "Finalizare"] as const;
type StepIdx = 0 | 1 | 2 | 3;

const step1Schema = z
  .object({
    adminName: z.string().trim().min(2, "Numele e prea scurt"),
    adminEmail: z.string().trim().email("Email invalid"),
    adminPassword: z.string().min(6, "Parola trebuie să aibă minim 6 caractere"),
    adminPasswordConfirm: z.string().min(6, "Confirmarea parolei e obligatorie"),
  })
  .refine((v) => v.adminPassword === v.adminPasswordConfirm, {
    path: ["adminPasswordConfirm"],
    message: "Parolele nu coincid",
  });

const step2Schema = z.object({
  companyName: z.string().trim().min(2, "Numele firmei e prea scurt"),
  companyTaxCode: z.string().trim().optional(),
  companyAddress: z.string().trim().optional(),
  companyCountry: z.string().trim().min(2).max(3),
});

const step3Schema = z.object({
  smtpHost: z.string().trim().min(1, "Host-ul SMTP e obligatoriu"),
  smtpPort: z.coerce.number().int().min(1).max(65535).default(587),
  smtpUser: z.string().trim().min(1, "Utilizatorul SMTP e obligatoriu"),
  smtpPass: z.string().min(1, "Parola SMTP e obligatorie"),
  smtpFromEmail: z.string().trim().email("From email invalid"),
  smtpFromName: z.string().trim().min(1, "From name e obligatoriu"),
  smtpSecure: z.boolean(),
});

const COUNTRY_OPTIONS: Array<{ code: string; label: string }> = [
  { code: "RO", label: "România (RO)" },
  { code: "DE", label: "Germania (DE)" },
  { code: "NL", label: "Olanda (NL)" },
  { code: "FR", label: "Franța (FR)" },
  { code: "IT", label: "Italia (IT)" },
  { code: "ES", label: "Spania (ES)" },
  { code: "UK", label: "Regatul Unit (UK)" },
  { code: "US", label: "Statele Unite (US)" },
];

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; [k: string]: unknown };
  if (!res.ok) throw new Error(data.error ?? "Operațiunea a eșuat");
  return data;
}

function Stepper({ step }: { step: StepIdx }) {
  const progress = ((step + 1) / STEPS.length) * 100;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-500">
        {STEPS.map((s, idx) => (
          <div key={s} className={idx <= step ? "text-gray-900 font-medium" : ""}>
            {idx + 1}. {s}
          </div>
        ))}
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
        <div className="h-2 rounded-full bg-slate-900 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export default function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState<StepIdx>(0);
  const [loading, setLoading] = useState(false);

  // Redirect dacă setup nu mai e necesar (race condition / refresh)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/setup", { cache: "no-store", credentials: "same-origin" });
        const json = (await res.json().catch(() => ({}))) as { needsSetup?: boolean };
        if (!cancelled && json.needsSetup === false) {
          router.replace("/login");
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [companyTaxCode, setCompanyTaxCode] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyCountry, setCompanyCountry] = useState("RO");

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("HR Department");
  const [smtpSecure, setSmtpSecure] = useState(false);

  const canNext = useMemo(() => {
    if (step === 0) return step1Schema.safeParse({ adminName, adminEmail, adminPassword, adminPasswordConfirm }).success;
    if (step === 1) return step2Schema.safeParse({ companyName, companyTaxCode, companyAddress, companyCountry }).success;
    if (step === 2)
      return step3Schema.safeParse({ smtpHost, smtpPort, smtpUser, smtpPass, smtpFromEmail, smtpFromName, smtpSecure }).success;
    return true;
  }, [
    step,
    adminName,
    adminEmail,
    adminPassword,
    adminPasswordConfirm,
    companyName,
    companyTaxCode,
    companyAddress,
    companyCountry,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpFromEmail,
    smtpFromName,
    smtpSecure,
  ]);

  async function next() {
    if (step === 0) {
      const parsed = step1Schema.safeParse({ adminName, adminEmail, adminPassword, adminPasswordConfirm });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Date invalide");
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      const parsed = step2Schema.safeParse({ companyName, companyTaxCode, companyAddress, companyCountry });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Date invalide");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      const parsed = step3Schema.safeParse({ smtpHost, smtpPort, smtpUser, smtpPass, smtpFromEmail, smtpFromName, smtpSecure });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Date invalide");
        return;
      }

      setLoading(true);
      try {
        await postJson("/api/setup", {
          adminName: adminName.trim(),
          adminEmail: adminEmail.trim(),
          adminPassword,
          companyName: companyName.trim(),
          companyTaxCode: companyTaxCode.trim() || undefined,
          companyAddress: companyAddress.trim() || undefined,
          companyCountry,
          smtpHost: smtpHost.trim(),
          smtpPort,
          smtpUser: smtpUser.trim(),
          smtpPass,
          smtpFromEmail: smtpFromEmail.trim(),
          smtpFromName: smtpFromName.trim(),
          smtpSecure,
        });
        toast.success("Setup complet!");
        setStep(3);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Eroare");
      } finally {
        setLoading(false);
      }
      return;
    }
  }

  async function testSmtp() {
    const parsed = step3Schema.safeParse({ smtpHost, smtpPort, smtpUser, smtpPass, smtpFromEmail, smtpFromName, smtpSecure });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Completează câmpurile SMTP");
      return;
    }
    setLoading(true);
    try {
      const r = (await postJson("/api/email/test", {
        host: smtpHost,
        port: smtpPort,
        user: smtpUser,
        pass: smtpPass,
        secure: smtpSecure,
      })) as { message?: string };
      toast.success(r.message ?? "Conexiune SMTP reușită!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-4 pt-16 pb-12">
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-white">
            <span className="font-bold">HR</span>
            <span className="text-sm font-medium tracking-tight">Management</span>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <Stepper step={step} />

          <div className="mt-6 transition-all duration-300">
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Creează contul de administrator</h1>
                  <p className="mt-1 text-sm text-gray-500">Acest cont va gestiona aplicația.</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Nume</label>
                  <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={adminName} onChange={(e) => setAdminName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Email</label>
                  <input type="email" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Parolă</label>
                  <input type="password" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
                  <div className="mt-1 text-xs text-gray-500">Minim 6 caractere.</div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Confirmă parola</label>
                  <input type="password" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={adminPasswordConfirm} onChange={(e) => setAdminPasswordConfirm(e.target.value)} />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Configurare firmă</h1>
                  <p className="mt-1 text-sm text-gray-500">Datele companiei apar pe documente și rapoarte.</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Nume firmă</label>
                  <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="ex: Cedol Autocraft SRL" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Cod fiscal (CUI) (opțional)</label>
                  <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={companyTaxCode} onChange={(e) => setCompanyTaxCode(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Adresă (opțional)</label>
                  <textarea className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={3} value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Țară</label>
                  <select className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={companyCountry} onChange={(e) => setCompanyCountry(e.target.value)}>
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Configurare Email SMTP</h1>
                  <p className="mt-1 text-sm text-gray-500">Este necesar pentru trimiterea fluturașilor pe email.</p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-gray-600">Host</label>
                    <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="ex: smtp.gmail.com" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Port</label>
                    <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value || "587"))} />
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} />
                      Secure (SSL)
                    </label>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-gray-600">Utilizator</label>
                    <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-gray-600">Parolă</label>
                    <input type="password" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} />
                    <div className="mt-1 text-xs text-gray-500">Parola se salvează criptat (ENCRYPTION_KEY).</div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-gray-600">From Email</label>
                    <input type="email" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={smtpFromEmail} onChange={(e) => setSmtpFromEmail(e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-gray-600">From Name</label>
                    <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={smtpFromName} onChange={(e) => setSmtpFromName(e.target.value)} placeholder="ex: HR Department" />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                    disabled={loading}
                    onClick={testSmtp}
                  >
                    Testează conexiunea
                  </button>
                  <div className="text-xs text-gray-500">Recomandat înainte de finalizare.</div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Setup complet!</h1>
                  <p className="mt-1 text-sm text-gray-500">Vei fi redirectat la login.</p>
                </div>
                <button
                  className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                  onClick={() => router.push("/login")}
                >
                  Mergi la Login
                </button>
              </div>
            )}
          </div>

          {step < 3 && (
            <div className="mt-6 flex items-center justify-between">
              <button
                className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                disabled={loading || step === 0}
                onClick={() => setStep((s) => (s === 0 ? s : ((s - 1) as StepIdx)))}
              >
                Înapoi
              </button>
              <button
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                disabled={loading || !canNext}
                onClick={next}
              >
                {step === 2 ? "Finalizează setup" : "Continuă"}
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-gray-400">
          Setup inițial — disponibil doar când nu există niciun user în baza de date.
        </div>
      </div>
    </div>
  );
}

