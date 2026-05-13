"use client";

import { ROLES_EMPLOYEES_RW } from "@/lib/roles";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import {
  DocumentList,
  type DocumentListFilteredStats,
} from "@/components/documents/DocumentList";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { useTranslation } from "@/hooks/useTranslation";
import { Upload } from "lucide-react";
import { Suspense, useCallback, useState } from "react";

export default function DocumentePage() {
  const { t } = useTranslation();
  const [showUpload, setShowUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [listKpi, setListKpi] = useState<DocumentListFilteredStats | null>(
    null,
  );

  const handleFilteredStats = useCallback(
    (stats: DocumentListFilteredStats) => {
      setListKpi(stats);
    },
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">
            {t("documents.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("pages.documents.subtitle")}
          </p>
          {listKpi != null && (
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-800">
                {t("pages.documents.kpiIntro")}
              </span>{" "}
              <span className="font-medium text-slate-800">
                {listKpi.total}
              </span>{" "}
              {t("pages.documents.kpiDocuments")}
              {listKpi.hasActiveFilters
                ? ` ${t("pages.documents.kpiAfterFilters")}`
                : ""}{" "}
              —{" "}
              <span className="font-medium text-red-700">
                {listKpi.expired}
              </span>{" "}
              {t("pages.documents.kpiExpired")}{" "}
              <span className="font-medium text-amber-800">
                {listKpi.expiringSoon}
              </span>{" "}
              {t("pages.documents.kpiExpiringSoon")} {listKpi.alertDays}{" "}
              {t("pages.documents.kpiDaysWindow")}
            </p>
          )}
        </div>
        <PermissionGuard allowedRoles={ROLES_EMPLOYEES_RW}>
          <button
            type="button"
            onClick={() => setShowUpload(!showUpload)}
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            <Upload size={16} aria-hidden />
            {showUpload
              ? t("pages.documents.uploadToggleClose")
              : t("pages.documents.uploadToggleOpen")}
          </button>
        </PermissionGuard>
      </div>

      {showUpload && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {t("pages.documents.uploadSectionTitle")}
          </h2>
          <DocumentUpload
            onSuccess={() => {
              setRefreshKey((k) => k + 1);
              setShowUpload(false);
            }}
          />
          <p className="mt-3 text-xs text-gray-400">
            {t("pages.documents.uploadHelper")}
          </p>
        </div>
      )}

      <Suspense
        fallback={
          <div className="rounded-xl border border-gray-200 bg-white py-12 text-center text-gray-400">
            {t("pages.documents.loadingList")}
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
