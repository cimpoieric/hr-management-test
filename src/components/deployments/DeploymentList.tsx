"use client";

import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { useTranslation } from "@/hooks/useTranslation";
import { useClientNowMs } from "@/hooks/useClientNowMs";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import {
  DEPLOYMENT_COUNTRIES,
  DEPLOYMENT_STATUSES,
  isValidDeploymentStatus,
} from "@/lib/countries";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Globe,
  MapPin,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

interface Deployment {
  id: number;
  country: string;
  city: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  notes: string | null;
  /** Last change (e.g. cancellation time for CANCELLED). */
  updatedAt?: string;
  employee: {
    id: number;
    firstName: string;
    lastName: string;
    position: string | null;
  } | null;
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  PLANNED: { bg: "bg-blue-100", text: "text-blue-700" },
  ACTIVE: { bg: "bg-green-100", text: "text-green-700" },
  COMPLETED: { bg: "bg-gray-100", text: "text-gray-700" },
  CANCELLED: { bg: "bg-gray-200", text: "text-gray-800" },
};

interface DeploymentListProps {
  employeeId?: number;
  showEmployee?: boolean;
}

export function DeploymentList({
  employeeId,
  showEmployee = false,
}: DeploymentListProps) {
  const { t, currentLanguage } = useTranslation();
  const dateLocale = currentLanguage === "ro" ? "ro-RO" : "en-US";
  const searchParams = useSearchParams();
  const clientNowMs = useClientNowMs();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [countryFilter, setCountryFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    const raw = searchParams.get("status")?.trim();
    if (!raw) return;
    const low = raw.toLowerCase();
    if (low === "active") {
      setStatusFilter("ACTIVE");
      return;
    }
    const up = raw.toUpperCase();
    if (isValidDeploymentStatus(up)) setStatusFilter(up);
  }, [searchParams]);

  useLayoutEffect(() => {
    setPage(1);
  }, [countryFilter, statusFilter, employeeId]);

  const syncDetachedOnce = useCallback(async () => {
    try {
      await fetch("/api/deployments/sync-detached", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // optional sync — list still loads
    }
  }, []);

  const fetchDeployments = useCallback(async () => {
    setLoading(true);
    try {
      if (!employeeId && page === 1) {
        await syncDetachedOnce();
      }
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (employeeId) params.set("employeeId", String(employeeId));
      if (statusFilter) params.set("status", statusFilter);
      if (countryFilter.length > 0) {
        params.set("countries", countryFilter.join(","));
      }

      const res = await fetch(`/api/deployments?${params.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("fetch");
      const data = (await res.json()) as {
        deployments?: Deployment[];
        total?: number;
        totalPages?: number;
      };
      setDeployments(data.deployments ?? []);
      setTotal(Number(data.total) || 0);
      setTotalPages(Math.max(0, Number(data.totalPages) || 0));
    } catch {
      setDeployments([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [employeeId, statusFilter, countryFilter, page, limit, syncDetachedOnce]);

  useEffect(() => {
    void fetchDeployments();
  }, [fetchDeployments]);

  async function handleDelete(id: number) {
    if (!confirm(t("components.deployments.list.confirmCancelDeployment")))
      return;
    try {
      const res = await fetch(`/api/deployments/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (res.ok) {
        void fetchDeployments();
      } else {
        const data = await res.json();
        alert(
          typeof data.error === "string" ? data.error : t("common.error"),
        );
      }
    } catch {
      alert(t("components.toast.networkError"));
    }
  }

  function toggleCountry(code: string) {
    setCountryFilter((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function formatDate(date: string | null): string {
    if (!date) return t("components.deployments.list.present");
    return new Date(date).toLocaleDateString(dateLocale);
  }

  function duration(start: string, end: string | null): string {
    const s = new Date(start);
    const e = end ? new Date(end) : new Date(clientNowMs ?? s.getTime());
    const months =
      (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
    if (months < 1)
      return t("components.deployments.list.duration.ltMonth");
    if (months === 1)
      return t("components.deployments.list.duration.oneMonth");
    if (months < 12)
      return t("components.deployments.list.duration.nMonths", { n: months });
    const years = Math.floor(months / 12);
    const rem = months % 12;
    if (rem === 0) {
      return years === 1
        ? t("components.deployments.list.duration.oneYear")
        : t("components.deployments.list.duration.nYears", { n: years });
    }
    if (years === 1) {
      return rem === 1
        ? t("components.deployments.list.duration.oneYearOneMonth")
        : t("components.deployments.list.duration.oneYearNMonths", {
            n: rem,
          });
    }
    return rem === 1
      ? t("components.deployments.list.duration.nYearsOneMonth", {
          n: years,
        })
      : t("components.deployments.list.duration.nYearsNMonths", {
          n: years,
          m: rem,
        });
  }

  function statusLabel(code: string): string {
    const k = `pages.deployments.status.${code}`;
    const label = t(k);
    return label === k ? code : label;
  }

  const showInitialSpinner = loading && deployments.length === 0 && total === 0;

  if (showInitialSpinner) {
    return (
      <div className="text-center py-12 text-gray-400">{t("common.loading")}</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Filter size={16} className="text-gray-400" />

        {DEPLOYMENT_COUNTRIES.slice(0, 5).map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => toggleCountry(c.code)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              countryFilter.includes(c.code)
                ? "bg-slate-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {c.flag} {c.code}
          </button>
        ))}

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border bg-white text-sm"
        >
          <option value="">{t("common.allStatuses")}</option>
          {DEPLOYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>

        {(countryFilter.length > 0 || statusFilter) && (
          <button
            type="button"
            onClick={() => {
              setCountryFilter([]);
              setStatusFilter("");
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            {t("common.reset")}
          </button>
        )}
      </div>

      {total === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl border">
          <MapPin size={48} className="mx-auto mb-4 text-gray-300" />
          <p>{t("components.deployments.list.emptyTitle")}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {deployments.map((dep) => {
              const country = DEPLOYMENT_COUNTRIES.find(
                (c) => c.code === dep.country,
              );
              const sc =
                STATUS_STYLE[dep.status] ?? STATUS_STYLE["PLANNED"]!;

              return (
                <div
                  key={dep.id}
                  className="bg-white rounded-xl border p-4 flex items-start gap-4 hover:shadow-sm transition-shadow"
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl shrink-0">
                    {country?.flag ?? "🌍"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">
                        {country?.name ?? dep.country}
                      </span>
                      {dep.city && (
                        <span className="text-sm text-gray-500">
                          · {dep.city}
                        </span>
                      )}
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}
                      >
                        {statusLabel(dep.status)}
                      </span>
                    </div>

                    {showEmployee && dep.employee && (
                      <p className="text-sm text-gray-600 mt-0.5">
                        {dep.employee.lastName} {dep.employee.firstName}
                        {dep.employee.position && ` · ${dep.employee.position}`}
                      </p>
                    )}

                    {dep.status === "CANCELLED" ? (
                      <div className="mt-2 space-y-1">
                        <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-800">
                          {t("components.deployments.list.cancelledOn")}{" "}
                          {formatDate(
                            dep.updatedAt ?? dep.endDate ?? dep.startDate,
                          )}
                        </span>
                        <p className="text-xs text-gray-400">
                          {t("components.deployments.list.plannedPeriod")}{" "}
                          {formatDate(dep.startDate)} {t("common.emDash")}{" "}
                          {formatDate(dep.endDate)}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(dep.startDate)} →{" "}
                          {formatDate(dep.endDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Globe size={12} />
                          {duration(dep.startDate, dep.endDate)}
                        </span>
                      </div>
                    )}

                    {dep.notes && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <StickyNote size={10} />
                        {dep.notes}
                      </p>
                    )}
                  </div>

                  <PermissionGuard allowedRoles={ROLES_SETTINGS_ADMIN}>
                    <button
                      type="button"
                      onClick={() => void handleDelete(dep.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                      title={t("components.deployments.list.cancelAction")}
                    >
                      <Trash2 size={16} />
                    </button>
                  </PermissionGuard>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
              <span>
                {t("components.deployments.list.pageOf", {
                  current: page,
                  total: totalPages,
                })}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={t("components.deployments.list.prevPageAria")}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={t("components.deployments.list.nextPageAria")}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
