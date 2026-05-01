"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

export default function SchimbaParolaPage() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function validatePassword(pw: string): string | null {
    if (pw.length < 8) return "Minim 8 caractere";
    if (!/[A-Z]/.test(pw)) return "Cel puțin o majusculă";
    if (!/[0-9]/.test(pw)) return "Cel puțin o cifră";
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) return "Cel puțin un caracter special";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    // Validare
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError("Toate câmpurile sunt obligatorii");
      return;
    }

    const validationError = validatePassword(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Parolele nu coincid");
      return;
    }

    if (oldPassword === newPassword) {
      setError("Parola nouă trebuie să fie diferită de cea veche");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Eroare");
        setSaving(false);
        return;
      }

      setSuccess(true);
      // Redirect după 2 secunde
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch {
      setError("Eroare de rețea");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-slate-900 text-white mb-4">
            <Lock size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Schimbare parolă</h1>
          <p className="text-sm text-gray-500 mt-1">
            Trebuie să schimbi parola înainte de a continua
          </p>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6">
          {success ? (
            <div className="text-center py-6">
              <CheckCircle2 size={48} className="mx-auto text-green-500 mb-3" />
              <h2 className="text-lg font-semibold text-gray-900">Parolă schimbată!</h2>
              <p className="text-sm text-gray-500 mt-1">
                Vei fi redirectat la dashboard...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Cerințe parolă */}
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 space-y-1">
                <p className="font-medium">Cerințe parolă nouă:</p>
                <ul className="space-y-0.5">
                  <li className={newPassword.length >= 8 ? "text-green-600" : ""}>
                    {newPassword.length >= 8 ? "✓" : "•"} Minim 8 caractere
                  </li>
                  <li className={/[A-Z]/.test(newPassword) ? "text-green-600" : ""}>
                    {/[A-Z]/.test(newPassword) ? "✓" : "•"} Cel puțin o majusculă
                  </li>
                  <li className={/[0-9]/.test(newPassword) ? "text-green-600" : ""}>
                    {/[0-9]/.test(newPassword) ? "✓" : "•"} Cel puțin o cifră
                  </li>
                  <li className={/[!@#$%^&*]/.test(newPassword) ? "text-green-600" : ""}>
                    {/[!@#$%^&*]/.test(newPassword) ? "✓" : "•"} Cel puțin un caracter special
                  </li>
                </ul>
              </div>

              {/* Parola veche */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parola curentă
                </label>
                <div className="relative">
                  <input
                    type={showOld ? "text" : "password"}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                    placeholder="Parola temporară sau curentă"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowOld(!showOld)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Parola nouă */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parola nouă
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                    placeholder="Minim 8 caractere..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirmare */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmă parola nouă
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                  placeholder="Repetă parola nouă"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg p-3">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Lock size={16} />
                )}
                {saving ? "Se salvează..." : "Schimbă parola"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
