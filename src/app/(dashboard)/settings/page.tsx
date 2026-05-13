"use client";

import { AppPreferencesPanel } from "@/components/settings/AppPreferencesPanel";
import { EmailSettingsPanel } from "@/components/settings/EmailSettingsPanel";
import { LanguageSelector } from "@/components/shared/LanguageSelector";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import { ROUTES } from "@/lib/routes";
import { UserRole } from "@/lib/roles";
import { ClipboardList, Mail, Settings, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export default function SetariPage() {
  const { t } = useTranslation();
  const { role, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<"prefs" | "email" | "audit">(
    "prefs",
  );

  const isAdmin = role === UserRole.ORG_ADMIN || role === UserRole.SUPER_ADMIN;

  const tabs = useMemo(
    () =>
      [
        {
          id: "prefs" as const,
          label: t("pages.settings.tabPrefs"),
          icon: SlidersHorizontal,
        },
        {
          id: "email" as const,
          label: t("pages.settings.tabEmail"),
          icon: Mail,
        },
        {
          id: "audit" as const,
          label: t("pages.settings.tabAudit"),
          icon: ClipboardList,
        },
      ] as const,
    [t],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("pages.settings.title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("pages.settings.subtitle")}
          </p>
        </div>
      </div>

      {loading ? null : !isAdmin ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {t("pages.settings.accessDenied")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px,1fr]">
          <aside className="rounded-xl border bg-white p-2 lg:p-3">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const active = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-slate-900 text-white"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon
                      size={16}
                      className={active ? "text-white" : "text-gray-400"}
                    />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="min-w-0 space-y-4">
            <div className="rounded-xl border bg-white p-4 sm:p-6">
              <h2 className="text-base font-semibold text-gray-900">
                {t("pages.settings.uiLanguageTitle")}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {t("pages.settings.uiLanguageHint")}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <LanguageSelector />
              </div>
            </div>

            {activeTab === "prefs" ? (
              <AppPreferencesPanel />
            ) : activeTab === "email" ? (
              <EmailSettingsPanel />
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border bg-white p-6">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t("pages.settings.auditCardTitle")}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {t("pages.settings.auditCardDesc")}
                  </p>
                  <div className="mt-4">
                    <Link
                      href={ROUTES.settingsAudit}
                      className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      {t("pages.settings.openAudit")}
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
