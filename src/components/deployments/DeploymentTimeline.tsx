"use client";

import { useClientNowMs } from "@/hooks/useClientNowMs";
import { useTranslation } from "@/hooks/useTranslation";
import { DEPLOYMENT_COUNTRIES, getCountryName } from "@/lib/countries";
import { Calendar } from "lucide-react";
import { useMemo } from "react";

interface TimelineDeployment {
  id: number;
  country: string;
  city: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  updatedAt?: string;
  employee?: { firstName: string; lastName: string } | null;
}

interface DeploymentTimelineProps {
  deployments: TimelineDeployment[];
  showEmployee?: boolean;
}

export function DeploymentTimeline({
  deployments,
  showEmployee = false,
}: DeploymentTimelineProps) {
  const { t, i18n } = useTranslation();
  const clientNowMs = useClientNowMs();
  const dateLocale = i18n.language?.startsWith("ro") ? "ro-RO" : "en-US";

  const monthNames = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        t(`components.deploymentTimeline.month${i}` as const),
      ),
    [t],
  );

  const grouped = useMemo(() => {
    const sorted = [...deployments].sort(
      (a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
    );

    const groups: Record<string, TimelineDeployment[]> = {};
    for (const dep of sorted) {
      const date = new Date(dep.startDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(dep);
    }

    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [deployments]);

  const maxDuration = useMemo(() => {
    if (deployments.length === 0) return 1;
    let max = 0;
    for (const dep of deployments) {
      const start = new Date(dep.startDate).getTime();
      const end =
        dep.status === "CANCELLED"
          ? new Date(dep.updatedAt ?? dep.startDate).getTime()
          : dep.endDate
            ? new Date(dep.endDate).getTime()
            : (clientNowMs ?? start);
      max = Math.max(max, end - start);
    }
    return max;
  }, [deployments, clientNowMs]);

  if (deployments.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
        <p>{t("components.deploymentTimeline.empty")}</p>
      </div>
    );
  }

  function barWidth(start: string, end: string | null): string {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : (clientNowMs ?? s);
    const pct = maxDuration > 0 ? ((e - s) / maxDuration) * 100 : 10;
    return `${Math.max(pct, 8)}%`;
  }

  function statusColor(status: string): string {
    switch (status) {
      case "ACTIVE":
        return "bg-green-500";
      case "PLANNED":
        return "bg-blue-400";
      case "COMPLETED":
        return "bg-gray-400";
      case "CANCELLED":
        return "bg-gray-400";
      default:
        return "bg-gray-300";
    }
  }

  return (
    <div className="space-y-6">
      {grouped.map(([key, list]) => {
        const [year, month = "1"] = key.split("-");
        const monthIdx = Math.max(0, Number.parseInt(month, 10) - 1);
        const countLabel =
          list.length === 1
            ? t("components.deploymentTimeline.deploymentsOne")
            : t("components.deploymentTimeline.deploymentsMany", {
                count: list.length,
              });
        return (
          <div key={key}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                {month}
              </div>
              <h4 className="font-semibold text-gray-900">
                {monthNames[monthIdx] ?? month} {year}
              </h4>
              <span className="text-xs text-gray-400">{countLabel}</span>
            </div>

            <div className="space-y-2 ml-4 border-l-2 border-gray-200 pl-4">
              {list.map((dep) => {
                const country = DEPLOYMENT_COUNTRIES.find(
                  (c) => c.code === dep.country,
                );

                return (
                  <div
                    key={dep.id}
                    className="bg-white rounded-lg border p-3 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden shrink-0">
                        <div
                          className={`h-full rounded-full ${statusColor(
                            dep.status,
                          )}`}
                          style={{
                            width: barWidth(
                              dep.startDate,
                              dep.status === "CANCELLED"
                                ? (dep.updatedAt ?? dep.startDate)
                                : dep.endDate,
                            ),
                          }}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {country?.flag ?? "🌍"}
                          </span>
                          <span className="font-medium text-gray-900 text-sm">
                            {country?.name ?? getCountryName(dep.country)}
                          </span>
                          {dep.city && (
                            <span className="text-xs text-gray-500">
                              {dep.city}
                            </span>
                          )}
                        </div>

                        {showEmployee && dep.employee && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {dep.employee.lastName} {dep.employee.firstName}
                          </p>
                        )}

                        <p className="text-xs text-gray-400 mt-1">
                          {dep.status === "CANCELLED" ? (
                            <>
                              <span className="inline-flex items-center rounded-full bg-gray-200 px-1.5 py-0.5 font-medium text-gray-800">
                                {t("components.deploymentTimeline.cancelledAt")}{" "}
                                {new Date(
                                  dep.updatedAt ?? dep.endDate ?? dep.startDate,
                                ).toLocaleDateString(dateLocale)}
                              </span>
                              <span className="block mt-0.5 text-gray-400">
                                {t("components.deploymentTimeline.planned")}{" "}
                                {new Date(dep.startDate).toLocaleDateString(
                                  dateLocale,
                                )}
                                {dep.endDate
                                  ? ` — ${new Date(dep.endDate).toLocaleDateString(dateLocale)}`
                                  : ""}
                              </span>
                            </>
                          ) : (
                            <>
                              {new Date(dep.startDate).toLocaleDateString(
                                dateLocale,
                              )}
                              {dep.endDate
                                ? ` → ${new Date(dep.endDate).toLocaleDateString(dateLocale)}`
                                : t("components.deploymentTimeline.ongoing")}
                            </>
                          )}
                        </p>
                      </div>

                      <div
                        className={`w-2.5 h-2.5 rounded-full ${statusColor(
                          dep.status,
                        )}`}
                        title={dep.status}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-4 pt-4 border-t text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          {t("components.deploymentTimeline.legendActive")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
          {t("components.deploymentTimeline.legendPlanned")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
          {t("components.deploymentTimeline.legendCompleted")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
          {t("components.deploymentTimeline.legendCancelled")}
        </span>
      </div>
    </div>
  );
}
