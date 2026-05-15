"use client";

import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type GlobalSettings = {
  defaultLanguage: "en" | "ro";
  theme: "light" | "dark" | "system";
  email: {
    host: string;
    port: number;
    user: string;
    hasPassword: boolean;
    fromEmail: string;
    fromName: string;
    subjectTemplate: string;
    bodyTemplate: string;
    isActive: boolean;
  };
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/settings", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load settings");
      const payload = await response.json();
      setSettings(payload.settings ?? null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unexpected error",
      );
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultLanguage: settings.defaultLanguage,
          theme: settings.theme,
          email: {
            ...settings.email,
            ...(smtpPassword.trim() ? { password: smtpPassword.trim() } : {}),
          },
        }),
      });
      if (!response.ok) throw new Error("Could not save settings");
      const payload = await response.json();
      setSettings(payload.settings ?? null);
      setSmtpPassword("");
      setSuccess("Settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unexpected error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <AdminPageHeader
        title="Settings"
        description="Global application defaults and email configuration."
      />

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      {loading ? (
        <AdminTableSkeleton columns={2} />
      ) : !settings ? (
        <AdminEmptyState
          title="Settings unavailable"
          description="Global application settings could not be loaded."
        />
      ) : (
        <div className="space-y-6 rounded-xl border bg-white p-4 sm:p-6">
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">
              Application defaults
            </h2>
            <select
              value={settings.defaultLanguage}
              onChange={(event) =>
                setSettings((current) =>
                  current
                    ? {
                        ...current,
                        defaultLanguage: event.target.value as "en" | "ro",
                      }
                    : current,
                )
              }
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="en">English</option>
              <option value="ro">Romanian</option>
            </select>
            <select
              value={settings.theme}
              onChange={(event) =>
                setSettings((current) =>
                  current
                    ? {
                        ...current,
                        theme: event.target.value as
                          | "light"
                          | "dark"
                          | "system",
                      }
                    : current,
                )
              }
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">
              Email configuration
            </h2>
            <Input
              value={settings.email.host}
              onChange={(event) =>
                setSettings((current) =>
                  current
                    ? {
                        ...current,
                        email: { ...current.email, host: event.target.value },
                      }
                    : current,
                )
              }
              placeholder="SMTP host"
            />
            <Input
              type="number"
              value={settings.email.port}
              onChange={(event) =>
                setSettings((current) =>
                  current
                    ? {
                        ...current,
                        email: {
                          ...current.email,
                          port: Number(event.target.value),
                        },
                      }
                    : current,
                )
              }
              placeholder="SMTP port"
            />
            <Input
              value={settings.email.user}
              onChange={(event) =>
                setSettings((current) =>
                  current
                    ? {
                        ...current,
                        email: { ...current.email, user: event.target.value },
                      }
                    : current,
                )
              }
              placeholder="SMTP user"
            />
            <Input
              type="password"
              value={smtpPassword}
              onChange={(event) => setSmtpPassword(event.target.value)}
              placeholder={
                settings.email.hasPassword
                  ? "Leave blank to keep current password"
                  : "SMTP password"
              }
            />
            <Input
              value={settings.email.fromEmail}
              onChange={(event) =>
                setSettings((current) =>
                  current
                    ? {
                        ...current,
                        email: {
                          ...current.email,
                          fromEmail: event.target.value,
                        },
                      }
                    : current,
                )
              }
              placeholder="From email"
            />
            <Input
              value={settings.email.fromName}
              onChange={(event) =>
                setSettings((current) =>
                  current
                    ? {
                        ...current,
                        email: {
                          ...current.email,
                          fromName: event.target.value,
                        },
                      }
                    : current,
                )
              }
              placeholder="From name"
            />
            <Input
              value={settings.email.subjectTemplate}
              onChange={(event) =>
                setSettings((current) =>
                  current
                    ? {
                        ...current,
                        email: {
                          ...current.email,
                          subjectTemplate: event.target.value,
                        },
                      }
                    : current,
                )
              }
              placeholder="Subject template"
            />
            <textarea
              value={settings.email.bodyTemplate}
              onChange={(event) =>
                setSettings((current) =>
                  current
                    ? {
                        ...current,
                        email: {
                          ...current.email,
                          bodyTemplate: event.target.value,
                        },
                      }
                    : current,
                )
              }
              className="min-h-28 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="Body template"
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={settings.email.isActive}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          email: {
                            ...current.email,
                            isActive: event.target.checked,
                          },
                        }
                      : current,
                  )
                }
              />
              Email delivery active
            </label>
          </section>

          <Button disabled={saving} onClick={() => void saveSettings()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save settings"}
          </Button>
        </div>
      )}
    </div>
  );
}
