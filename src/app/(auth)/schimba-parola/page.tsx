"use client";

import { useTranslation } from "@/hooks/useTranslation";
import { ROUTES } from "@/lib/routes";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

function validatePassword(pw: string, t: (k: string) => string): string | null {
  if (pw.length < 8) return t("pages.changePassword.valMinLen");
  if (!/[A-Z]/.test(pw)) return t("pages.changePassword.valUpper");
  if (!/[0-9]/.test(pw)) return t("pages.changePassword.valDigit");
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw))
    return t("pages.changePassword.valSpecial");
  return null;
}

export default function SchimbaParolaPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError(t("pages.changePassword.allFieldsRequired"));
      return;
    }

    const validationError = validatePassword(newPassword, t);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("pages.changePassword.passwordMismatch"));
      return;
    }

    if (oldPassword === newPassword) {
      setError(t("pages.changePassword.samePassword"));
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
        setError(data.error ?? t("pages.changePassword.genericError"));
        setSaving(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(ROUTES.dashboard);
      }, 2000);
    } catch {
      setError(t("pages.login.networkError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-slate-900 text-white mb-4">
            <Lock size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("pages.changePassword.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("pages.changePassword.subtitle")}
          </p>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6">
          {success ? (
            <div className="text-center py-6">
              <CheckCircle2 size={48} className="mx-auto text-green-500 mb-3" />
              <h2 className="text-lg font-semibold text-gray-900">
                {t("pages.changePassword.successTitle")}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {t("pages.changePassword.successSubtitle")}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 space-y-1">
                <p className="font-medium">
                  {t("pages.changePassword.requirementsTitle")}
                </p>
                <ul className="space-y-0.5">
                  <li
                    className={newPassword.length >= 8 ? "text-green-600" : ""}
                  >
                    {newPassword.length >= 8 ? "\u2713" : "\u2022"}{" "}
                    {t("pages.changePassword.reqMinLength")}
                  </li>
                  <li
                    className={
                      /[A-Z]/.test(newPassword) ? "text-green-600" : ""
                    }
                  >
                    {/[A-Z]/.test(newPassword) ? "\u2713" : "\u2022"}{" "}
                    {t("pages.changePassword.reqUppercase")}
                  </li>
                  <li
                    className={
                      /[0-9]/.test(newPassword) ? "text-green-600" : ""
                    }
                  >
                    {/[0-9]/.test(newPassword) ? "\u2713" : "\u2022"}{" "}
                    {t("pages.changePassword.reqDigit")}
                  </li>
                  <li
                    className={
                      /[!@#$%^&*]/.test(newPassword) ? "text-green-600" : ""
                    }
                  >
                    {/[!@#$%^&*]/.test(newPassword) ? "\u2713" : "\u2022"}{" "}
                    {t("pages.changePassword.reqSpecial")}
                  </li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("pages.changePassword.currentPassword")}
                </label>
                <div className="relative">
                  <input
                    type={showOld ? "text" : "password"}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                    placeholder={t("pages.changePassword.currentPlaceholder")}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("pages.changePassword.newPassword")}
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                    placeholder={t("pages.changePassword.newPlaceholder")}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("pages.changePassword.confirmPassword")}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                  placeholder={t("pages.changePassword.confirmPlaceholder")}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg p-3">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

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
                {saving
                  ? t("pages.changePassword.saving")
                  : t("pages.changePassword.submit")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
