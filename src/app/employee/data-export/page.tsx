"use client";

import { GdprBanner } from "@/components/GdprBanner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { UserRole } from "@/lib/roles";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

export default function EmployeeDataExportPage() {
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function downloadData() {
    setDownloading(true);
    try {
      const res = await fetch("/api/employee/me/export-data");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(
          typeof err.error === "string" ? err.error : "Export esuat",
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition");
      const match = cd?.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? "date-personale.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Datele au fost descarcate.");
    } finally {
      setDownloading(false);
    }
  }

  async function requestDeletion() {
    if (
      !window.confirm(
        "Confirmi solicitarea de stergere a datelor personale? Nu se sterge nimic automat.",
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/employee/me/gdpr-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "DELETE" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          typeof data.error === "string" ? data.error : "Solicitare esuata",
        );
        return;
      }
      toast.success(
        data.message ??
          "Solicitarea ta a fost inregistrata. Vei fi contactat de adminul HR.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ProtectedRoute requiredRoles={[UserRole.EMPLOYEE]}>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <Link href="/dashboard" className="text-sm text-blue-700 hover:underline">
            Inapoi
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Datele mele (GDPR)
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Portabilitate si solicitari privind datele personale.
          </p>
        </div>

        <GdprBanner />

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Export date personale
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Descarca un fisier JSON cu datele tale: profil, pontaj, fluturasi
            (valori numerice) si lista documentelor (fara link-uri de download).
          </p>
          <button
            type="button"
            disabled={downloading}
            onClick={() => void downloadData()}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {downloading ? "Se pregatesc datele..." : "Descarca datele mele"}
          </button>
        </section>

        <section className="rounded-xl border border-rose-200 bg-rose-50/50 p-6">
          <h2 className="text-lg font-semibold text-rose-900">
            Stergere date personale
          </h2>
          <p className="mt-2 text-sm text-rose-800">
            Trimite o solicitare catre HR. Datele nu sunt sterse automat.
          </p>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void requestDeletion()}
            className="mt-4 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-900 disabled:opacity-50"
          >
            {deleting
              ? "Se trimite..."
              : "Solicita stergerea datelor personale"}
          </button>
        </section>
      </div>
    </ProtectedRoute>
  );
}
