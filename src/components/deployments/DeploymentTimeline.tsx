"use client";

import { useMemo } from "react";
import { Calendar } from "lucide-react";
import { DEPLOYMENT_COUNTRIES, getCountryName } from "@/lib/countries";

interface TimelineDeployment {
  id: number;
  country: string;
  city: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  employee?: { firstName: string; lastName: string } | null;
}

interface DeploymentTimelineProps {
  deployments: TimelineDeployment[];
  showEmployee?: boolean;
}

/**
 * Timeline vizual simplu — listează detașările grupate pe luni.
 * Fiecare entry are o bară vizuală care reprezintă durata relativă.
 */
export function DeploymentTimeline({
  deployments,
  showEmployee = false,
}: DeploymentTimelineProps) {
  const grouped = useMemo(() => {
    // Sortează descrescător după startDate
    const sorted = [...deployments].sort(
      (a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );

    // Grupează pe an-lună
    const groups: Record<string, TimelineDeployment[]> = {};
    for (const dep of sorted) {
      const date = new Date(dep.startDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(dep);
    }

    // Sortează cheile descrescător
    return Object.entries(groups).sort(
      ([a], [b]) => b.localeCompare(a)
    );
  }, [deployments]);

  const monthNames = [
    "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
    "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
  ];

  if (deployments.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
        <p>Nicio detașare de afișat</p>
      </div>
    );
  }

  // Calculează durata maximă pentru scale
  const maxDuration = useMemo(() => {
    let max = 0;
    for (const dep of deployments) {
      const start = new Date(dep.startDate).getTime();
      const end = dep.endDate
        ? new Date(dep.endDate).getTime()
        : Date.now();
      max = Math.max(max, end - start);
    }
    return max;
  }, [deployments]);

  function barWidth(start: string, end: string | null): string {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
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
        return "bg-red-400";
      default:
        return "bg-gray-300";
    }
  }

  return (
    <div className="space-y-6">
      {grouped.map(([key, list]) => {
        const [year, month = "1"] = key.split("-");
        const monthIdx = Math.max(0, parseInt(month, 10) - 1);
        return (
          <div key={key}>
            {/* Header lună */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                {month}
              </div>
              <h4 className="font-semibold text-gray-900">
                {monthNames[monthIdx] ?? month} {year}
              </h4>
              <span className="text-xs text-gray-400">
                {list.length} detașare{list.length > 1 ? "ri" : ""}
              </span>
            </div>

            {/* Entries */}
            <div className="space-y-2 ml-4 border-l-2 border-gray-200 pl-4">
              {list.map((dep) => {
                const country = DEPLOYMENT_COUNTRIES.find(
                  (c) => c.code === dep.country
                );

                return (
                  <div
                    key={dep.id}
                    className="bg-white rounded-lg border p-3 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      {/* Bară vizuală durată */}
                      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden shrink-0">
                        <div
                          className={`h-full rounded-full ${statusColor(
                            dep.status
                          )}`}
                          style={{
                            width: barWidth(dep.startDate, dep.endDate),
                          }}
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {country?.flag ?? "🌍"}
                          </span>
                          <span className="font-medium text-gray-900 text-sm">
                            {country?.name ?? dep.country}
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
                          {new Date(dep.startDate).toLocaleDateString("ro-RO")}
                          {dep.endDate
                            ? ` → ${new Date(dep.endDate).toLocaleDateString(
                                "ro-RO"
                              )}`
                            : " → în desfășurare"}
                        </p>
                      </div>

                      {/* Status dot */}
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${statusColor(
                          dep.status
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

      {/* Legendă */}
      <div className="flex flex-wrap items-center gap-4 pt-4 border-t text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          Activă
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
          Planificată
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
          Finalizată
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          Anulată
        </span>
      </div>
    </div>
  );
}
