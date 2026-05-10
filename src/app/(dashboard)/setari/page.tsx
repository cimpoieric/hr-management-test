"use client";

import { useMemo, useState } from "react";
import {
  Settings,
  Users,
  SlidersHorizontal,
  ClipboardList,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { UsersSettingsPanel } from "@/components/settings/UsersSettingsPanel";
import { AppPreferencesPanel } from "@/components/settings/AppPreferencesPanel";
import { EmailSettingsPanel } from "@/components/settings/EmailSettingsPanel";

export default function SetariPage() {
  const { role, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<"users" | "prefs" | "email" | "audit">("users");

  const isAdmin = role === "administrator";

  const tabs = useMemo(
    () =>
      [
        { id: "users" as const, label: "Utilizatori", icon: Users },
        { id: "prefs" as const, label: "Preferințe aplicație", icon: SlidersHorizontal },
        { id: "email" as const, label: "Email", icon: Mail },
        { id: "audit" as const, label: "Jurnal activitate", icon: ClipboardList },
      ] as const,
    []
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Setări</h1>
          <p className="text-sm text-gray-500">
            Administrare sistem — utilizatori, preferințe, audit
          </p>
        </div>
      </div>

      {loading ? null : !isAdmin ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Acces interzis - Contactează administratorul
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px,1fr]">
          {/* Sidebar setări */}
          <aside className="rounded-xl border bg-white p-2 lg:p-3">
            <nav className="space-y-1">
              {tabs.map((t) => {
                const active = activeTab === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active ? "bg-slate-900 text-white" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon size={16} className={active ? "text-white" : "text-gray-400"} />
                    {t.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Conținut tab */}
          <section className="min-w-0">
            {activeTab === "users" ? (
              <UsersSettingsPanel />
            ) : activeTab === "prefs" ? (
              <AppPreferencesPanel />
            ) : activeTab === "email" ? (
              <EmailSettingsPanel />
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border bg-white p-6">
                  <h2 className="text-lg font-semibold text-gray-900">Jurnal activitate (Audit log)</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Vezi istoricul acțiunilor din sistem (cine/ce/când/de unde).
                  </p>
                  <div className="mt-4">
                    <Link
                      href="/setari/audit"
                      className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      Deschide audit log
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
