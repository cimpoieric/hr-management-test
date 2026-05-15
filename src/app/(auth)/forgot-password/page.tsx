"use client";

import { useTranslation } from "@/hooks/useTranslation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? t("pages.forgotPassword.genericError"));
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError(t("pages.login.networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-slate-900 text-white mb-4">
            <Mail size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("pages.forgotPassword.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("pages.forgotPassword.subtitle")}
          </p>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6">
          {success ? (
            <div className="text-center space-y-4">
              <CheckCircle2 size={40} className="mx-auto text-green-500" />
              <p className="text-sm text-gray-600">
                {t("pages.forgotPassword.successMessage")}
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-slate-900 hover:underline"
              >
                <ArrowLeft size={14} />
                {t("pages.forgotPassword.backToLogin")}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("auth.email")}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                  placeholder="admin@firma.local"
                  required
                  autoFocus
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
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Mail size={16} />
                )}
                {loading
                  ? t("pages.forgotPassword.sending")
                  : t("pages.forgotPassword.submit")}
              </button>

              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft size={14} />
                {t("pages.forgotPassword.backToLogin")}
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
