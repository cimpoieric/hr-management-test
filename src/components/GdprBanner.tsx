"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type GdprBannerProps = {
  /** Onboarding admin: marcheaza ultimul angajat creat. */
  onboardingMode?: boolean;
};

export function GdprBanner({ onboardingMode = false }: GdprBannerProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    if (onboardingMode) {
      const key = "gdpr-banner-onboarding-ack";
      setVisible(sessionStorage.getItem(key) !== "1");
      setLoading(false);
      return;
    }
    const res = await fetch("/api/employee/me/gdpr-status");
    const data = res.ok ? await res.json() : { needsBanner: false };
    setVisible(Boolean(data.needsBanner));
    setLoading(false);
  }, [onboardingMode]);

  useEffect(() => {
    void load();
  }, [load]);

  async function acknowledge() {
    setSaving(true);
    try {
      if (onboardingMode) {
        const res = await fetch("/api/onboarding/gdpr-informed", {
          method: "POST",
        });
        if (res.ok) {
          sessionStorage.setItem("gdpr-banner-onboarding-ack", "1");
          setVisible(false);
        }
        return;
      }
      const res = await fetch("/api/employee/me/gdpr-informed", {
        method: "POST",
      });
      if (res.ok) setVisible(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !visible) return null;

  return (
    <div
      role="region"
      aria-label="Informare GDPR"
      className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-800"
    >
      <p className="font-medium text-slate-900">
        Informare privind prelucrarea datelor personale
      </p>
      <p className="mt-2 leading-relaxed">
        Datele tale sunt prelucrate in baza contractului de munca si a
        obligatiilor legale. Acceseaza{" "}
        <Link href="/privacy-policy" className="text-blue-700 underline">
          Politica de Confidentialitate
        </Link>{" "}
        pentru detalii.
      </p>
      <button
        type="button"
        disabled={saving}
        onClick={() => void acknowledge()}
        className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Se salveaza..." : "Am inteles"}
      </button>
    </div>
  );
}
