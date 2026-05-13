"use client";

import { useTranslation } from "@/hooks/useTranslation";
import { Check, Info, Loader2, PlugZap, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type SmtpConfigResponse = {
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

type EmailSettingsForm = {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
};

export default function EmailSettingsClient() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState(false);

  const defaultValues = useMemo<EmailSettingsForm>(
    () => ({
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      smtpUser: "",
      smtpPass: "",
      fromEmail: "",
      fromName: "HR Management",
      subjectTemplate: t("components.emailSettings.defaultSubject"),
      bodyTemplate: "",
      isActive: true,
    }),
    [t],
  );

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<EmailSettingsForm>({
    defaultValues,
    mode: "onBlur",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/email/settings", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const data = (await res
          .json()
          .catch(() => ({}))) as Partial<SmtpConfigResponse> & {
          error?: string;
        };
        if (!res.ok)
          throw new Error(
            data.error ?? t("components.emailSettings.loadFailed"),
          );
        if (cancelled) return;
        setHasPassword(Boolean(data.hasPassword));
        setValue("smtpHost", String(data.host ?? defaultValues.smtpHost), {
          shouldDirty: false,
        });
        setValue("smtpPort", Number(data.port ?? defaultValues.smtpPort), {
          shouldDirty: false,
        });
        setValue("smtpUser", String(data.user ?? ""), { shouldDirty: false });
        setValue("fromEmail", String(data.fromEmail ?? ""), {
          shouldDirty: false,
        });
        setValue("fromName", String(data.fromName ?? defaultValues.fromName), {
          shouldDirty: false,
        });
        setValue(
          "subjectTemplate",
          String(data.subjectTemplate ?? defaultValues.subjectTemplate),
          { shouldDirty: false },
        );
        setValue("bodyTemplate", String(data.bodyTemplate ?? ""), {
          shouldDirty: false,
        });
        setValue("isActive", Boolean(data.isActive ?? true), {
          shouldDirty: false,
        });
        setValue("smtpPass", "", { shouldDirty: false });
      } catch (e) {
        toast.error(
          e instanceof Error
            ? e.message
            : t("components.emailSettings.genericError"),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [defaultValues, setValue, t]);

  const save = handleSubmit(async (data) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/email/settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: data.smtpHost,
          port: Number(data.smtpPort),
          user: data.smtpUser,
          password: data.smtpPass.trim().length > 0 ? data.smtpPass : undefined,
          fromEmail: data.fromEmail,
          fromName: data.fromName,
          subjectTemplate: data.subjectTemplate,
          bodyTemplate: data.bodyTemplate,
          isActive: data.isActive,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok)
        throw new Error(body.error ?? t("components.emailSettings.saveFailed"));
      toast.success(t("components.toast.emailSettingsSaved"));
      setValue("smtpPass", "", { shouldDirty: false });
      setHasPassword(true);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : t("components.emailSettings.genericError");
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  });

  const test = handleSubmit(async (data) => {
    setTesting(true);
    setError(null);
    try {
      const realTime = data.smtpPass.trim().length > 0;
      const res = await fetch("/api/email/test", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: realTime
          ? JSON.stringify({
              host: data.smtpHost,
              port: Number(data.smtpPort),
              user: data.smtpUser,
              pass: data.smtpPass,
              secure: Number(data.smtpPort) === 465,
            })
          : JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok)
        throw new Error(body.error ?? t("components.emailSettings.testFailed"));
      toast.success(body.message ?? t("components.toast.emailConnectionOk"));
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : t("components.emailSettings.genericError");
      setError(msg);
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  });

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="animate-spin" size={16} />
          {t("components.emailSettings.loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("components.emailSettings.title")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("components.emailSettings.subtitle")}
        </p>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-medium">
            {t("components.emailSettings.errorHeading")}
          </p>
          <p className="text-sm">{error}</p>
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {t("components.emailSettings.smtpTitle")}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {t("components.emailSettings.smtpPasswordEncrypted")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={test}
              disabled={testing || saving}
              className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                {testing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <PlugZap size={16} />
                )}
                {t("components.emailSettings.testConnection")}
              </span>
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || testing}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {t("components.emailSettings.save")}
              </span>
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-gray-600">
              {t("components.emailSettings.host")}
            </label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="smtp.gmail.com"
              {...register("smtpHost", {
                required: t("components.emailSettings.hostRequired"),
              })}
            />
            {errors.smtpHost ? (
              <p className="mt-1 text-red-500 text-sm">
                {errors.smtpHost.message}
              </p>
            ) : null}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">
              {t("components.emailSettings.port")}
            </label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              type="number"
              {...register("smtpPort", {
                valueAsNumber: true,
                required: t("components.emailSettings.portRequired"),
                min: {
                  value: 1,
                  message: t("components.emailSettings.portRequired"),
                },
              })}
            />
            {errors.smtpPort ? (
              <p className="mt-1 text-red-500 text-sm">
                {errors.smtpPort.message}
              </p>
            ) : null}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">
              {t("components.emailSettings.user")}
            </label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder={t("components.emailSettings.userPlaceholder")}
              {...register("smtpUser", {
                required: t("components.emailSettings.userRequired"),
              })}
            />
            {errors.smtpUser ? (
              <p className="mt-1 text-red-500 text-sm">
                {errors.smtpUser.message}
              </p>
            ) : null}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">
              {t("components.emailSettings.password")}
            </label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              type="password"
              placeholder={
                hasPassword
                  ? t("components.emailSettings.passwordPlaceholderSet")
                  : t("components.emailSettings.passwordPlaceholderEmpty")
              }
              {...register("smtpPass", {
                validate: (v) => {
                  const s = String(v ?? "").trim();
                  if (s.length > 0) return true;
                  return hasPassword
                    ? true
                    : t("components.emailSettings.passwordRequiredFirst");
                },
              })}
            />
            <div className="mt-1 text-xs text-gray-500">
              {t("components.emailSettings.passwordLeaveBlank")}
            </div>
            {errors.smtpPass ? (
              <p className="mt-1 text-red-500 text-sm">
                {errors.smtpPass.message}
              </p>
            ) : null}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">
              {t("components.emailSettings.fromEmail")}
            </label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder={t("components.emailSettings.fromEmailPlaceholder")}
              {...register("fromEmail", {
                required: t("components.emailSettings.fromEmailRequired"),
              })}
            />
            {errors.fromEmail ? (
              <p className="mt-1 text-red-500 text-sm">
                {errors.fromEmail.message}
              </p>
            ) : null}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">
              {t("components.emailSettings.fromName")}
            </label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder={t("components.emailSettings.fromNamePlaceholder")}
              {...register("fromName", {
                required: t("components.emailSettings.fromNameRequired"),
              })}
            />
            {errors.fromName ? (
              <p className="mt-1 text-red-500 text-sm">
                {errors.fromName.message}
              </p>
            ) : null}
          </div>
          <div className="md:col-span-2">
            <div className="text-xs text-gray-500">
              {t("components.emailSettings.connectionHint")}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <div className="flex items-start gap-2">
            <Info size={16} className="mt-0.5 shrink-0 text-blue-700" />
            <div className="space-y-2">
              <div className="font-semibold">
                {t("components.emailSettings.gmailTitle")}
              </div>
              <ol className="list-decimal pl-5 space-y-1 text-blue-900">
                <li>
                  {t("components.emailSettings.gmailStep1Before")}{" "}
                  <a
                    className="underline underline-offset-2"
                    href="https://myaccount.google.com/security"
                    target="_blank"
                    rel="noreferrer"
                  >
                    https://myaccount.google.com/security
                  </a>
                </li>
                <li>{t("components.emailSettings.gmailStep2")}</li>
                <li>
                  {t("components.emailSettings.gmailStep3Before")}{" "}
                  <a
                    className="underline underline-offset-2"
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noreferrer"
                  >
                    https://myaccount.google.com/apppasswords
                  </a>
                </li>
                <li>{t("components.emailSettings.gmailStep4")}</li>
                <li>{t("components.emailSettings.gmailStep5")}</li>
                <li>{t("components.emailSettings.gmailStep6")}</li>
                <li>{t("components.emailSettings.gmailStep7")}</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">
          {t("components.emailSettings.templateTitle")}
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600">
              {t("components.emailSettings.subjectLabel")}
            </label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder={t("components.emailSettings.subjectPlaceholder")}
              {...register("subjectTemplate")}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">
              {t("components.emailSettings.bodyLabel")}
            </label>
            <textarea
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              rows={8}
              placeholder={t("components.emailSettings.bodyPlaceholder")}
              {...register("bodyTemplate")}
            />
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <span className="inline-flex items-center gap-2">
            <Check size={14} />
            {t("components.emailSettings.templateHint")}
          </span>
        </div>
      </div>
    </div>
  );
}
