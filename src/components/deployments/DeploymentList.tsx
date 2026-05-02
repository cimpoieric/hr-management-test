"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  MapPin,
  Trash2,
  Filter,
  Calendar,
  Globe,
  StickyNote,
} from "lucide-react";
import {
  DEPLOYMENT_COUNTRIES,
  DEPLOYMENT_STATUSES,
  getCountryLabel,
  getCountryName,
  isValidDeploymentStatus,
} from "@/lib/countries";

interface Deployment {
  id: number;
  country: string;
  city: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  notes: string | null;
  /** Ultima modificare (ex. moment anulare pentru CANCELLED). */
  updatedAt?: string;
  employee: {
    id: number;
    firstName: string;
    lastName: string;
    position: string | null;
  } | null;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  PLANNED: { bg: "bg-blue-100", text: "text-blue-700", label: "Planificată" },
  ACTIVE: { bg: "bg-green-100", text: "text-green-700", label: "Activă" },
  COMPLETED: { bg: "bg-gray-100", text: "text-gray-700", label: "Finalizată" },
  CANCELLED: { bg: "bg-gray-200", text: "text-gray-800", label: "Anulată" },
};

interface DeploymentListProps {
  employeeId?: number;
  showEmployee?: boolean;
}

export function DeploymentList({
  employeeId,
  showEmployee = false,
}: DeploymentListProps) {
  const searchParams = useSearchParams();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [countryFilter, setCountryFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("");

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

  const fetchDeployments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (employeeId) params.set("employeeId", String(employeeId));
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/deployments?${params.toString()}`);
      if (!res.ok) throw new Error("Eroare");
      const data = await res.json();

      let list: Deployment[] = data.deployments ?? [];

      // Filtrare client-side pe țări (multi-select)
      if (countryFilter.length > 0) {
        list = list.filter((d) => countryFilter.includes(d.country));
      }

      setDeployments(list);
    } catch {
      setDeployments([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId, statusFilter, countryFilter]);

  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  async function handleDelete(id: number) {
    if (!confirm("Anulezi această detașare?")) return;
    try {
      const res = await fetch(`/api/deployments/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchDeployments();
      } else {
        const data = await res.json();
        alert(data.error ?? "Eroare");
      }
    } catch {
      alert("Eroare de rețea");
    }
  }

  function toggleCountry(code: string) {
    setCountryFilter((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function formatDate(date: string | null): string {
    if (!date) return "prezent";
    return new Date(date).toLocaleDateString("ro-RO");
  }

  function duration(start: string, end: string | null): string {
    const s = new Date(start);
    const e = end ? new Date(end) : new Date();
    const months =
      (e.getFullYear() - s.getFullYear()) * 12 +
      (e.getMonth() - s.getMonth());
    if (months < 1) return "< 1 lună";
    if (months === 1) return "1 lună";
    if (months < 12) return `${months} luni`;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    if (rem === 0) return `${years} an${years > 1 ? "i" : ""}`;
    return `${years} an${years > 1 ? "i" : ""} ${rem} lun${rem > 1 ? "i" : "ă"}`;
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Se încarcă...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filtre */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter size={16} className="text-gray-400" />

        {/* Țări multi-select */}
        {DEPLOYMENT_COUNTRIES.slice(0, 5).map((c) => (
          <button
            key={c.code}
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
          <option value="">Toate statusurile</option>
          {DEPLOYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_CONFIG[s]?.label ?? s}
            </option>
          ))}
        </select>

        {(countryFilter.length > 0 || statusFilter) && (
          <button
            onClick={() => {
              setCountryFilter([]);
              setStatusFilter("");
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Reset
          </button>
        )}
      </div>

      {/* Listă */}
      {deployments.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl border">
          <MapPin size={48} className="mx-auto mb-4 text-gray-300" />
          <p>Nicio detașare</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deployments.map((dep) => {
            const country = DEPLOYMENT_COUNTRIES.find(
              (c) => c.code === dep.country
            );
            const sc = STATUS_CONFIG[dep.status] ?? STATUS_CONFIG["PLANNED"]!;

            return (
              <div
                key={dep.id}
                className="bg-white rounded-xl border p-4 flex items-start gap-4 hover:shadow-sm transition-shadow"
              >
                {/* Flag */}
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl shrink-0">
                  {country?.flag ?? "🌍"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">
                      {country?.name ?? dep.country}
                    </span>
                    {dep.city && (
                      <span className="text-sm text-gray-500">· {dep.city}</span>
                    )}
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}
                    >
                      {sc.label}
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
                        Anulată la:{" "}
                        {formatDate(
                          dep.updatedAt ??
                            dep.endDate ??
                            dep.startDate
                        )}
                      </span>
                      <p className="text-xs text-gray-400">
                        Perioadă prevăzută: {formatDate(dep.startDate)} —{" "}
                        {formatDate(dep.endDate)}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDate(dep.startDate)} → {formatDate(dep.endDate)}
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

                {/* Actions */}
                <button
                  onClick={() => handleDelete(dep.id)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                  title="Anulează"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
