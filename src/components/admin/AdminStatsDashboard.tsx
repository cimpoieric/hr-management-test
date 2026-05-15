"use client";

import { formatDate } from "@/components/admin/adminUtils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Clock3,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type AdminStatsResponse = {
  organizationCount: number;
  userCount: number;
  employeeCount: number;
  activeTrialCount: number;
  estimatedRevenueRon: number;
  revenueBreakdown: Array<{
    plan: string;
    count: number;
    unitPriceRon: number;
    subtotalRon: number;
  }>;
  organizationsCreatedLast30Days: Array<{ date: string; count: number }>;
  recentOrganizations: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    plan: string;
    createdAt: string;
  }>;
  recentUsers: Array<{
    id: string;
    name: string | null;
    email: string;
    role: string;
    organizationName: string;
    createdAt: string;
  }>;
};

function formatRon(value: number): string {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatChartLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "short",
  });
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentClass,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  accentClass: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          {subtitle ? (
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        <div
          className={`rounded-lg p-2.5 ${accentClass} bg-opacity-10 shrink-0`}
        >
          <Icon size={20} className={accentClass.replace("bg-", "text-")} />
        </div>
      </div>
    </div>
  );
}

function OrganizationsCreatedChart({
  points,
}: {
  points: AdminStatsResponse["organizationsCreatedLast30Days"];
}) {
  const maxCount = useMemo(
    () => Math.max(1, ...points.map((point) => point.count)),
    [points],
  );

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp size={18} className="text-slate-400" />
        <h2 className="font-semibold text-slate-900">
          Organizations created in the last 30 days
        </h2>
      </div>
      <div className="flex h-48 items-end gap-1">
        {points.map((point) => {
          const height = Math.max(6, Math.round((point.count / maxCount) * 100));
          return (
            <div
              key={point.date}
              className="group flex min-w-0 flex-1 flex-col items-center justify-end"
              title={`${formatChartLabel(point.date)}: ${point.count}`}
            >
              <div
                className="w-full rounded-t bg-sky-500 transition-all group-hover:bg-sky-600"
                style={{ height: `${height}%` }}
              />
              <span className="mt-2 hidden text-[10px] text-slate-400 sm:block">
                {formatChartLabel(point.date)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecentOrganizationsTable({
  rows,
}: {
  rows: AdminStatsResponse["recentOrganizations"];
}) {
  return (
    <section className="rounded-xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold text-slate-900">Latest organizations</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-5 py-6 text-slate-500" colSpan={4}>
                  No organizations yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {row.name}
                  </td>
                  <td className="px-5 py-3 capitalize text-slate-600">
                    {row.plan}
                  </td>
                  <td className="px-5 py-3 capitalize text-slate-600">
                    {row.status}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {formatDate(row.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RecentUsersTable({ rows }: { rows: AdminStatsResponse["recentUsers"] }) {
  return (
    <section className="rounded-xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold text-slate-900">Latest users</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">User</th>
              <th className="px-5 py-3 font-medium">Organization</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-5 py-6 text-slate-500" colSpan={4}>
                  No users yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">
                      {row.name ?? row.email}
                    </div>
                    <div className="text-slate-500">{row.email}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {row.organizationName}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{row.role}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {formatDate(row.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

export function AdminStatsDashboard() {
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/stats", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load admin statistics");
      const payload = await response.json();
      setStats(payload.stats ?? payload.data ?? null);
    } catch (loadError) {
      setStats(null);
      setError(
        loadError instanceof Error ? loadError.message : "Unexpected error",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revenueSubtitle = useMemo(() => {
    if (!stats?.revenueBreakdown.length) {
      return "Estimated from active and grace plans";
    }
    return stats.revenueBreakdown
      .map(
        (row) =>
          `${row.count} x ${row.plan} x ${formatRon(row.unitPriceRon)}`,
      )
      .join(" \u00b7 ");
  }, [stats]);

  if (loading) {
    return <StatsSkeleton />;
  }

  if (error || !stats) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {error || "Admin statistics are unavailable."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total Organizations"
          value={stats.organizationCount.toLocaleString("ro-RO")}
          icon={Building2}
          accentClass="bg-blue-500"
        />
        <StatCard
          title="Total Users"
          value={stats.userCount.toLocaleString("ro-RO")}
          icon={Users}
          accentClass="bg-violet-500"
        />
        <StatCard
          title="Total Employees"
          value={stats.employeeCount.toLocaleString("ro-RO")}
          icon={UserRound}
          accentClass="bg-emerald-500"
        />
        <StatCard
          title="Active Trials"
          value={stats.activeTrialCount.toLocaleString("ro-RO")}
          icon={Clock3}
          accentClass="bg-amber-500"
        />
        <StatCard
          title="Revenue (estimated)"
          value={formatRon(stats.estimatedRevenueRon)}
          subtitle={revenueSubtitle}
          icon={Wallet}
          accentClass="bg-rose-500"
        />
      </div>

      <OrganizationsCreatedChart
        points={stats.organizationsCreatedLast30Days}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <RecentOrganizationsTable rows={stats.recentOrganizations} />
        <RecentUsersTable rows={stats.recentUsers} />
      </div>
    </div>
  );
}
