"use client";

import { Suspense, useState, useCallback } from "react";
import { Upload } from "lucide-react";
import {
  DocumentList,
  type DocumentListFilteredStats,
} from "@/components/documents/DocumentList";
import { DocumentUpload } from "@/components/documents/DocumentUpload";

export default function DocumentePage() {
  const [showUpload, setShowUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [listKpi, setListKpi] = useState<DocumentListFilteredStats | null>(null);

  const handleFilteredStats = useCallback((stats: DocumentListFilteredStats) => {
    setListKpi(stats);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Documente</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestionare documente — upload, monitorizare, expirare
          </p>
          {listKpi != null && (
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-800">Indicatori (lista afișată):</span>{" "}
              <span className="font-medium text-slate-800">{listKpi.total}</span> documente
              {listKpi.hasActiveFilters ? " după filtrele curente" : ""} —{" "}
              <span className="font-medium text-red-700">{listKpi.expired}</span> expirate
              (dată depășită sau status),{" "}
              <span className="font-medium text-amber-800">{listKpi.expiringSoon}</span> expiră
              în următoarele {listKpi.alertDays} zile (fereastra din setări).
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowUpload(!showUpload)}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          <Upload size={16} aria-hidden />
          {showUpload ? "Închide upload" : "Upload document"}
        </button>
      </div>

      {showUpload && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Upload document nou</h2>
          <DocumentUpload
            onSuccess={() => {
              setRefreshKey((k) => k + 1);
              setShowUpload(false);
            }}
          />
          <p className="mt-3 text-xs text-gray-400">
            Alegeți angajatul din lista din formular, apoi completați detaliile documentului.
          </p>
        </div>
      )}

      <Suspense
        fallback={
          <div className="rounded-xl border border-gray-200 bg-white py-12 text-center text-gray-400">
            Se încarcă lista…
          </div>
        }
      >
        <DocumentList
          key={refreshKey}
          showEmployee
          onRequestUpload={() => setShowUpload(true)}
          onFilteredStatsChange={handleFilteredStats}
        />
      </Suspense>
    </div>
  );
}
