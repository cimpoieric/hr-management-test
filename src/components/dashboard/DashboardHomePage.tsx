"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Users,
  MapPin,
  FileText,
  AlertTriangle,
  Download,
  TrendingUp,
  Clock,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import { ro, tAuditAction, formatAuditActivityDetail } from "@/messages";
import { ROUTES } from "@/lib/routes";

type DashboardStats = {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  activeDeployments: number;
  expiredDocuments: number;
  expiringSoonDocuments: number;
  pendingImports: number;
  monthlySalaryCost: number;
  monthlySalaryEmployeeCount: number;
  monthlySalaryCurrency: string;
  /** Moneda cea mai frecventă la angajați (afișare secundară); suma e în RON. */
  monthlySalaryPredominantCurrency: string;
  documentAlertDays: number;
};

type DeploymentCountry = {
  country: string;
  code: string;
  count: number;
};

type ActivityItem = {
  id: number;
  action: string;
  entity: string;
  entityId: number | null;
  userName: string | null;
  createdAt: string;
};

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
          {subtitle && (
            <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
          )}
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

function DeploymentChart({ deploymentsByCountry }: { deploymentsByCountry: DeploymentCountry[] }) {
  const total = deploymentsByCountry.reduce((s, d) => s + d.count, 0);
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
        <h3 className="font-semibold text-gray-900">Detașări active pe țări</h3>
      </div>

      <div className="space-y-3">
        {deploymentsByCountry.length === 0 && (
          <p className="text-sm text-gray-400">Nu există detașări active.</p>
        )}
        {deploymentsByCountry.map((d, idx) => {
          const pct = Math.round((d.count / total) * 100);
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
        <span className="text-gray-500">Total</span>
        <span className="font-bold text-gray-900">{total}</span>
      </div>
    </div>
  );
}

function DocumentStatus({ stats }: { stats: DashboardStats }) {
  return (
    <div className="bg-white rounded-xl border p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <FileText size={18} className="text-gray-400" />
        <h3 className="font-semibold text-gray-900">Stare documente</h3>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
          <AlertTriangle size={18} className="text-red-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800">
              Documente expirate
            </p>
            <p className="text-xs text-red-600">
              {stats.expiredDocuments} documente necesită atenție imediată
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
              Expiră curând
            </p>
            <p className="text-xs text-amber-600">
              {stats.expiringSoonDocuments} documente în următoarele {stats.documentAlertDays} zile
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
              {ro.dashboard.documentsHealthyTitle}
            </p>
            <p className="text-xs text-green-600">
              {ro.dashboard.documentsHealthyHint}
            </p>
          </div>
          <CheckCircle2 size={18} className="text-green-500 shrink-0" />
        </div>
      </div>
    </div>
  );
}

function EmployeeBreakdown({ stats }: { stats: DashboardStats }) {
  return (
    <div className="bg-white rounded-xl border p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Users size={18} className="text-gray-400" />
        <h3 className="font-semibold text-gray-900">{ro.dashboard.employeeBreakdownTitle}</h3>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm text-gray-600">Activi</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {stats.activeEmployees}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-300" />
            <span className="text-sm text-gray-600">Inactivi</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {stats.inactiveEmployees}
          </span>
        </div>

        <div className="pt-3 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Total</span>
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
    typeof entityIdRaw === "number" && Number.isFinite(entityIdRaw) ? entityIdRaw : null;
  const userName = typeof o.userName === "string" ? o.userName : null;
  return { id, action, entity, entityId, userName, createdAt };
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

export default function DashboardHomePage() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [deploymentsByCountry, setDeploymentsByCountry] = useState<DeploymentCountry[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    fetch("/api/dashboard/overview", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed"))))
      .then((data) => {
        setStats({
          totalEmployees: Number(data.stats?.totalEmployees ?? 0),
          activeEmployees: Number(data.stats?.activeEmployees ?? 0),
          inactiveEmployees: Number(data.stats?.inactiveEmployees ?? 0),
          activeDeployments: Number(data.stats?.activeDeployments ?? 0),
          expiredDocuments: Number(data.stats?.expiredDocuments ?? 0),
          expiringSoonDocuments: Number(data.stats?.expiringSoonDocuments ?? 0),
          pendingImports: Number(data.stats?.pendingImports ?? 0),
          monthlySalaryCost: Number(data.stats?.monthlySalaryCost ?? 0),
          monthlySalaryEmployeeCount: Number(data.stats?.monthlySalaryEmployeeCount ?? 0),
          monthlySalaryCurrency: String(data.stats?.monthlySalaryCurrency ?? "RON"),
          monthlySalaryPredominantCurrency: String(
            data.stats?.monthlySalaryPredominantCurrency ??
              data.stats?.monthlySalaryCurrency ??
              "RON"
          ),
          documentAlertDays: Number(data.stats?.documentAlertDays ?? 30),
        });
        setDeploymentsByCountry(Array.isArray(data.deploymentsByCountry) ? data.deploymentsByCountry : []);
        const rawActivity = Array.isArray(data.recentActivity) ? data.recentActivity : [];
        setRecentActivity(
          rawActivity
            .map((item: unknown) => normalizeRecentActivityItem(item))
            .filter((x: ActivityItem | null): x is ActivityItem => x !== null)
        );
      })
      .catch(() => {
        setStats(EMPTY_STATS);
        setDeploymentsByCountry([]);
        setRecentActivity([]);
      });
  }, []);

  return (
    <div className="space-y-6">
      {/* Header secțiune */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {ro.dashboard.title}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {ro.dashboard.overviewLine.replace(
            "{date}",
            new Date().toLocaleDateString("ro-RO")
          )}
        </p>
      </div>

      {/* Grid carduri — 4 coloane desktop, 2 tableta, 1 mobil */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard
          title="Total angajați"
          value={stats.totalEmployees}
          subtitle={`${stats.activeEmployees} activi`}
          icon={Users}
          accentColor="bg-blue-500"
          href={ROUTES.employees}
          badge={{
            text: `${stats.inactiveEmployees} inactivi`,
            color: "bg-slate-100 text-slate-700",
          }}
        />

        <StatCard
          title="Detașări active"
          value={stats.activeDeployments}
          subtitle={`în ${deploymentsByCountry.length} țări`}
          icon={MapPin}
          accentColor="bg-orange-500"
          href={ROUTES.deployments}
          badge={{
            text: `${stats.activeDeployments} angajați detașați`,
            color: "bg-orange-100 text-orange-700",
          }}
        />

        <StatCard
          title="Documente expirate"
          value={stats.expiredDocuments}
          subtitle="necesită atenție imediată"
          icon={AlertTriangle}
          accentColor="bg-red-500"
          href={`${ROUTES.documents}?filter=expired`}
          badge={{
            text: "Acțiune necesară",
            color: "bg-red-100 text-red-700",
          }}
        />

        <StatCard
          title="Importuri pending"
          value={stats.pendingImports}
          subtitle="așteaptă aprobare"
          icon={Download}
          accentColor="bg-purple-500"
          href={ROUTES.imports}
          badge={{
            text: `${stats.pendingImports} de revizuit`,
            color: "bg-purple-100 text-purple-700",
          }}
        />

        <StatCard
          title="Cost salarial lunar estimat"
          value={`${stats.monthlySalaryCost.toLocaleString("ro-RO")} ${stats.monthlySalaryCurrency}`}
          subtitle={`${stats.monthlySalaryEmployeeCount} angajați LUNAR`}
          icon={Wallet}
          accentColor="bg-emerald-500"
          href={`${ROUTES.employees}?salaryType=LUNAR`}
          badge={{
            text: `In ${stats.monthlySalaryPredominantCurrency}, total estimat in RON (curs indicativ)`,
            color: "bg-emerald-100 text-emerald-700",
          }}
        />
      </div>

      {/* Rând 2 — 3 coloane */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DeploymentChart deploymentsByCountry={deploymentsByCountry} />
        <DocumentStatus stats={stats} />
        <EmployeeBreakdown stats={stats} />
      </div>

      {/* Rând 3 — activitate recentă (placeholder) */}
      <div className="bg-white rounded-xl border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-gray-400" />
            <h3 className="font-semibold text-gray-900">{ro.dashboard.recentActivity}</h3>
          </div>
          <span className="text-xs text-gray-400">{ro.dashboard.last7Days}</span>
        </div>

        <div className="space-y-3">
          {recentActivity.length === 0 && (
            <p className="text-sm text-gray-400">{ro.dashboard.noRecentActivity}</p>
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
                  {formatAuditActivityDetail(item.entity, item.entityId, item.userName)}
                </p>
              </div>
              <span className="text-xs text-gray-400 shrink-0">
                {formatRelativeTime(item.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(dateIso: string): string {
  const date = new Date(dateIso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return ro.common.relativeNow;
  if (mins < 60) return ro.common.relativeMins.replace("{n}", String(mins));
  const hours = Math.floor(mins / 60);
  if (hours < 24) return ro.common.relativeHours.replace("{n}", String(hours));
  const days = Math.floor(hours / 24);
  if (days < 7) return ro.common.relativeDays.replace("{n}", String(days));
  return date.toLocaleDateString("ro-RO");
}
