"use client";

import { useTranslation } from "@/hooks/useTranslation";
import { ROUTES } from "@/lib/routes";
import { formatAuditActivityDetail, tAuditAction } from "@/messages";
import { DataErrorState } from "@/components/shared/DataFetchStates";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  MapPin,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useIsClient } from "@/hooks/useIsClient";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ActivityItem, DashboardStats, DeploymentCountry } from "@/types";

const EMPTY_STATS: DashboardStats = {
  totalEmployees: 0,
  activeEmployees: 0,
  inactiveEmployees: 0,
  activeDeployments: 0,
  expiredDocuments: 0,
  expiringSoonDocuments: 0,
  pendingImports: 0,
  monthlySalaryCost: 0,
  monthlySalaryEmployeeCount: 0,
  monthlySalaryCurrency: "RON",
  monthlySalaryPredominantCurrency: "RON",
  documentAlertDays: 30,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentColor,
  badge,
  href,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  accentColor: string;
  badge?: { text: string; color: string };
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block bg-white rounded-xl border p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div
          className={`p-2.5 rounded-lg ${accentColor} bg-opacity-10 shrink-0`}
        >
          <Icon size={20} className={accentColor.replace("bg-", "text-")} />
        </div>
      </div>
      {badge && (
        <div className="mt-3">
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${badge.color}`}
          >
            {badge.text}
          </span>
        </div>
      )}
    </Link>
  );
}

function DeploymentChart({
  deploymentsByCountry,
  totalActiveDeployments,
}: {
  deploymentsByCountry: DeploymentCountry[];
  /** Total real (toate țările); barele pot fi doar top 6. */
  totalActiveDeployments: number;
}) {
  const { t } = useTranslation();
  const displayedSum = deploymentsByCountry.reduce((s, d) => s + d.count, 0);
  const total =
    totalActiveDeployments > 0 ? totalActiveDeployments : displayedSum;
  const colors = [
    "bg-orange-500",
    "bg-yellow-500",
    "bg-green-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
  ];

  return (
    <div className="bg-white rounded-xl border p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <MapPin size={18} className="text-gray-400" />
        <h3 className="font-semibold text-gray-900">
          {t("pages.dashboard.deploymentsByCountry")}
        </h3>
      </div>

      <div className="space-y-3">
        {deploymentsByCountry.length === 0 && (
          <p className="text-sm text-gray-400">
            {t("pages.dashboard.noActiveDeployments")}
          </p>
        )}
        {deploymentsByCountry.map((d, idx) => {
          const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
          return (
            <div key={d.code}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">
                  {d.country}{" "}
                  <span className="text-gray-400 font-normal">({d.code})</span>
                </span>
                <span className="text-gray-900 font-semibold">{d.count}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={`${colors[idx % colors.length]} h-2 rounded-full transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
        <span className="text-gray-500">{t("pages.dashboard.total")}</span>
        <span className="font-bold text-gray-900">{total}</span>
      </div>
    </div>
  );
}

function DocumentStatus({ stats }: { stats: DashboardStats }) {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-xl border p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <FileText size={18} className="text-gray-400" />
        <h3 className="font-semibold text-gray-900">
          {t("pages.dashboard.documentStatusTitle")}
        </h3>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
          <AlertTriangle size={18} className="text-red-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800">
              {t("pages.dashboard.expiredDocsTitle")}
            </p>
            <p className="text-xs text-red-600">
              {t("pages.dashboard.expiredDocsHint", {
                n: stats.expiredDocuments,
              })}
            </p>
          </div>
          <span className="text-lg font-bold text-red-700 shrink-0">
            {stats.expiredDocuments}
          </span>
        </div>

        <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
          <Clock size={18} className="text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800">
              {t("pages.dashboard.expiringSoonTitle")}
            </p>
            <p className="text-xs text-amber-600">
              {t("pages.dashboard.expiringSoonHint", {
                n: stats.expiringSoonDocuments,
                days: stats.documentAlertDays,
              })}
            </p>
          </div>
          <span className="text-lg font-bold text-amber-700 shrink-0">
            {stats.expiringSoonDocuments}
          </span>
        </div>

        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
          <CheckCircle2 size={18} className="text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800">
              {t("pages.dashboard.documentsHealthyTitle")}
            </p>
            <p className="text-xs text-green-600">
              {t("pages.dashboard.documentsHealthyHint")}
            </p>
          </div>
          <CheckCircle2 size={18} className="text-green-500 shrink-0" />
        </div>
      </div>
    </div>
  );
}

function EmployeeBreakdown({ stats }: { stats: DashboardStats }) {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-xl border p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Users size={18} className="text-gray-400" />
        <h3 className="font-semibold text-gray-900">
          {t("pages.dashboard.employeeBreakdownTitle")}
        </h3>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm text-gray-600">
              {t("pages.dashboard.activeLabel")}
            </span>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {stats.activeEmployees}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-300" />
            <span className="text-sm text-gray-600">
              {t("pages.dashboard.inactiveLabel")}
            </span>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {stats.inactiveEmployees}
          </span>
        </div>

        <div className="pt-3 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{t("pages.dashboard.total")}</span>
            <span className="font-bold text-gray-900">
              {stats.totalEmployees}
            </span>
          </div>
          <div className="mt-2 w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="bg-green-500 h-2.5 rounded-full"
              style={{
                width: `${(stats.activeEmployees / stats.totalEmployees) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function normalizeRecentActivityItem(raw: unknown): ActivityItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = Number(o.id);
  if (!Number.isFinite(id)) return null;
  const action = typeof o.action === "string" ? o.action : "";
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
  if (!action || !createdAt) return null;
  const entity = typeof o.entity === "string" ? o.entity : "Unknown";
  const entityIdRaw = o.entityId;
  const entityId =
    typeof entityIdRaw === "number" && Number.isFinite(entityIdRaw)
      ? entityIdRaw
      : null;
  const userName = typeof o.userName === "string" ? o.userName : null;
  return { id, action, entity, entityId, userName, createdAt };
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

export default function DashboardHomePage() {
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [deploymentsByCountry, setDeploymentsByCountry] = useState<
    DeploymentCountry[]
  >([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [dashLoading, setDashLoading] = useState(true);
  const [dashError, setDashError] = useState(false);
  const [overviewDateLabel, setOverviewDateLabel] = useState("");
  const isClient = useIsClient();

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    setDashError(false);
    try {
      const [statsRes, overviewRes] = await Promise.all([
        fetch("/api/dashboard/stats", { cache: "no-store" }),
        fetch("/api/dashboard/overview", { cache: "no-store" }),
      ]);
      if (!statsRes.ok) throw new Error("stats failed");
      const statsPayload = await statsRes.json();
      const s = statsPayload.stats ?? statsPayload;
      setStats({
        totalEmployees: Number(s.totalEmployees ?? 0),
        activeEmployees: Number(s.activeEmployees ?? 0),
        inactiveEmployees: Number(s.inactiveEmployees ?? 0),
        activeDeployments: Number(s.activeDeployments ?? 0),
        expiredDocuments: Number(s.expiredDocuments ?? 0),
        expiringSoonDocuments: Number(s.expiringSoonDocuments ?? 0),
        pendingImports: Number(s.pendingImports ?? 0),
        monthlySalaryCost: Number(s.monthlySalaryCost ?? 0),
        monthlySalaryEmployeeCount: Number(s.monthlySalaryEmployeeCount ?? 0),
        monthlySalaryCurrency: String(s.monthlySalaryCurrency ?? "RON"),
        monthlySalaryPredominantCurrency: String(
          s.monthlySalaryPredominantCurrency ??
            s.monthlySalaryCurrency ??
            "RON",
        ),
        documentAlertDays: Number(s.documentAlertDays ?? 30),
      });

      const overviewData = overviewRes.ok ? await overviewRes.json() : {};
      setDeploymentsByCountry(
        Array.isArray(overviewData.deploymentsByCountry)
          ? overviewData.deploymentsByCountry
          : [],
      );
      const rawActivity = Array.isArray(overviewData.recentActivity)
        ? overviewData.recentActivity
        : [];
      setRecentActivity(
        rawActivity
          .map((item: unknown) => normalizeRecentActivityItem(item))
          .filter((x: ActivityItem | null): x is ActivityItem => x !== null),
      );
    } catch {
      setStats(EMPTY_STATS);
      setDeploymentsByCountry([]);
      setRecentActivity([]);
      setDashError(true);
    } finally {
      setDashLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const loc = i18n.language?.startsWith("ro") ? "ro-RO" : "en-US";
    setOverviewDateLabel(new Date().toLocaleDateString(loc));
  }, [i18n.language]);

  function formatRelativeTime(dateIso: string): string {
    const date = new Date(dateIso);
    const loc = i18n.language?.startsWith("ro") ? "ro-RO" : "en-US";
    if (!isClient) {
      const d = new Date(dateIso);
      if (Number.isNaN(d.getTime())) return "—";
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    }
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return t("pages.dashboard.relativeNow");
    if (mins < 60)
      return t("pages.dashboard.relativeMins", { n: String(mins) });
    const hours = Math.floor(mins / 60);
    if (hours < 24)
      return t("pages.dashboard.relativeHours", { n: String(hours) });
    const days = Math.floor(hours / 24);
    if (days < 7) return t("pages.dashboard.relativeDays", { n: String(days) });
    return date.toLocaleDateString(loc);
  }

  return (
    <div className="space-y-6">
      {/* Header secțiune */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("pages.dashboard.title")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("pages.dashboard.overviewLine", {
            date:
              overviewDateLabel ||
              (i18n.language?.startsWith("ro") ? "…" : "\u2026"),
          })}
        </p>
      </div>

      {dashLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border bg-white p-5 shadow-sm space-y-3"
              >
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border bg-white p-5 shadow-sm min-h-[200px] space-y-3"
              >
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-32 w-full" />
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </p>
        </div>
      ) : dashError ? (
        <div className="rounded-xl border bg-white shadow-sm">
          <DataErrorState
            message={t("components.dataFetchStates.loadFailed")}
            retryLabel={t("common.retry")}
            onRetry={() => void loadDashboard()}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <StatCard
              title={t("pages.dashboard.statTotalEmployees")}
              value={stats.totalEmployees}
              subtitle={t("pages.dashboard.statActiveShort", {
                n: stats.activeEmployees,
              })}
              icon={Users}
              accentColor="bg-blue-500"
              href={ROUTES.employees}
              badge={{
                text: t("pages.dashboard.statInactiveBadge", {
                  n: stats.inactiveEmployees,
                }),
                color: "bg-slate-100 text-slate-700",
              }}
            />

            <StatCard
              title={t("pages.dashboard.statDeploymentsTitle")}
              value={stats.activeDeployments}
              subtitle={t("pages.dashboard.statInCountries", {
                n: deploymentsByCountry.length,
              })}
              icon={MapPin}
              accentColor="bg-orange-500"
              href={`${ROUTES.deployments}?status=active`}
              badge={{
                text: t("pages.dashboard.statDeployedBadge", {
                  n: stats.activeDeployments,
                }),
                color: "bg-orange-100 text-orange-700",
              }}
            />

            <StatCard
              title={t("pages.dashboard.statExpiredDocs")}
              value={stats.expiredDocuments}
              subtitle={t("pages.dashboard.statNeedsImmediate")}
              icon={AlertTriangle}
              accentColor="bg-red-500"
              href={`${ROUTES.documents}?status=expired`}
              badge={{
                text: t("pages.dashboard.statActionRequired"),
                color: "bg-red-100 text-red-700",
              }}
            />

            <StatCard
              title={t("pages.dashboard.statPendingImports")}
              value={stats.pendingImports}
              subtitle={t("pages.dashboard.statAwaitingApproval")}
              icon={Download}
              accentColor="bg-purple-500"
              href={`${ROUTES.imports}?status=pending`}
              badge={{
                text: t("pages.dashboard.statToReview", {
                  n: stats.pendingImports,
                }),
                color: "bg-purple-100 text-purple-700",
              }}
            />

            <StatCard
              title={t("pages.dashboard.statMonthlyCost")}
              value={`${stats.monthlySalaryCost.toLocaleString(
                isClient && i18n.language?.startsWith("ro") ? "ro-RO" : "en-US",
              )} ${stats.monthlySalaryCurrency}`}
              subtitle={t("pages.dashboard.statActiveEmployeesShort", {
                n: stats.activeEmployees,
              })}
              icon={Wallet}
              accentColor="bg-emerald-500"
              href={ROUTES.pay}
              badge={{
                text: t("pages.dashboard.statSalaryBadge", {
                  cur: stats.monthlySalaryPredominantCurrency,
                }),
                color: "bg-emerald-100 text-emerald-700",
              }}
            />
          </div>

          {/* Rând 2 — 3 coloane */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <DeploymentChart
              deploymentsByCountry={deploymentsByCountry}
              totalActiveDeployments={stats.activeDeployments}
            />
            <DocumentStatus stats={stats} />
            <EmployeeBreakdown stats={stats} />
          </div>

          {/* Rând 3 — activitate recentă (placeholder) */}
          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-gray-400" />
                <h3 className="font-semibold text-gray-900">
                  {t("pages.dashboard.recentActivity")}
                </h3>
              </div>
              <span className="text-xs text-gray-400">
                {t("pages.dashboard.last7Days")}
              </span>
            </div>

            <div className="space-y-3">
              {recentActivity.length === 0 && (
                <p className="text-sm text-gray-400">
                  {t("pages.dashboard.noRecentActivity")}
                </p>
              )}
              {recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 py-2 border-b last:border-b-0"
                >
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      item.action === "CREATE"
                        ? "bg-green-500"
                        : item.action === "UPDATE"
                          ? "bg-blue-500"
                          : item.action.includes("IMPORT")
                            ? "bg-purple-500"
                            : "bg-gray-400"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {tAuditAction(item.action)}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {formatAuditActivityDetail(
                        item.entity,
                        item.entityId,
                        item.userName,
                      )}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
