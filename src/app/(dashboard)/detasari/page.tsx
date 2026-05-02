"use client";

import { useState, useEffect } from "react";
import { MapPin, LayoutList, CalendarDays } from "lucide-react";
import { DeploymentList } from "@/components/deployments/DeploymentList";
import { DeploymentTimeline } from "@/components/deployments/DeploymentTimeline";

type ViewMode = "list" | "timeline";

export default function DetasariPage() {
  const [view, setView] = useState<ViewMode>("list");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Detașări</h1>
          <p className="text-sm text-gray-500 mt-1">
            Management detașări în străinătate — {view === "list" ? "listă" : "timeline"}
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-white rounded-lg border overflow-hidden">
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
              view === "list"
                ? "bg-slate-900 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <LayoutList size={14} />
            Listă
          </button>
          <button
            onClick={() => setView("timeline")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
              view === "timeline"
                ? "bg-slate-900 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <CalendarDays size={14} />
            Timeline
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <StatsBar key={refreshKey} />

      {/* Content */}
      {view === "list" ? (
        <DeploymentList showEmployee key={"list-" + refreshKey} />
      ) : (
        <TimelineView key={"timeline-" + refreshKey} />
      )}
    </div>
  );
}

// ─── Stats Bar ───────────────────────────────────────────────────────────────

function StatsBar() {
  const [stats, setStats] = useState<
    { code: string; name: string; flag: string; count: number }[]
  >([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/deployments/stats")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setStats(data.stats ?? []);
          setTotal(Number(data.total ?? 0));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return null;
  if (total === 0) return null;

  return (
    <div className="bg-white rounded-xl border shadow-sm p-4">
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-slate-900" />
          <span className="text-sm font-semibold text-gray-900">
            {total} detașări active
          </span>
        </div>
        {stats.map((s) => (
          <div
            key={s.code}
            className="flex items-center gap-1.5 text-sm text-gray-600"
          >
            <span className="text-lg">{s.flag}</span>
            <span className="font-medium">{s.count}</span>
            <span className="text-gray-400">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Timeline View ───────────────────────────────────────────────────────────

function TimelineView() {
  const [deployments, setDeployments] = useState<
    Parameters<typeof DeploymentTimeline>[0]["deployments"]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/deployments")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setDeployments(
            (data.deployments ?? []).map((d: Record<string, unknown>) => ({
              id: d.id as number,
              country: d.country as string,
              city: d.city as string | null,
              startDate: d.startDate as string,
              endDate: d.endDate as string | null,
              status: d.status as string,
              updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : undefined,
              employee: d.employee as { firstName: string; lastName: string } | null,
            }))
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Se încarcă...</div>;
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <DeploymentTimeline deployments={deployments} showEmployee />
    </div>
  );
}
