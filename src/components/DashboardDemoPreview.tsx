"use client";

import {
  BarChart3,
  Building2,
  Calendar,
  Clock,
  FileText,
  LayoutDashboard,
  Users,
  Wallet,
} from "lucide-react";

type DashboardDemoPreviewProps = {
  isPlaying?: boolean;
};

const NAV: {
  icon: typeof LayoutDashboard;
  label: string;
  active?: boolean;
}[] = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: Users, label: "Employees" },
  { icon: Clock, label: "Attendance" },
  { icon: Wallet, label: "Payroll" },
  { icon: FileText, label: "Reports" },
  { icon: Calendar, label: "Calendar" },
];

const STATS = [
  { label: "Active employees", value: "24", delta: "+2 this month", color: "#2D62FF" },
  { label: "Hours this week", value: "892h", delta: "98% attendance", color: "#7B61FF" },
  { label: "Payroll ready", value: "\u20AC42.8k", delta: "Week 20", color: "#00C9A7" },
] as const;

const ROWS = [
  { name: "Maria Popescu", role: "HR Manager", status: "Present", statusColor: "#00C9A7" },
  { name: "Ion Georgescu", role: "Developer", status: "Remote", statusColor: "#2D62FF" },
  { name: "Elena Dumitru", role: "Accountant", status: "Present", statusColor: "#00C9A7" },
  { name: "Andrei Stan", role: "Designer", status: "Leave", statusColor: "#F59E0B" },
] as const;

const BARS = [42, 68, 55, 82, 61, 74, 88, 70, 92, 78, 85, 95];

export function DashboardDemoPreview({ isPlaying = false }: DashboardDemoPreviewProps) {
  return (
    <div
      className="flex h-full min-h-[280px] w-full overflow-hidden text-left sm:min-h-[320px]"
      style={{ background: "linear-gradient(160deg, #0B1120 0%, #111840 50%, #0a0e27 100%)" }}
    >
      <aside
        className="hidden w-[140px] shrink-0 flex-col border-r sm:flex"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}
      >
        <div
          className="flex items-center gap-2 border-b px-3 py-3"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-950">
            <Building2 className="h-3.5 w-3.5 text-white" aria-hidden />
          </span>
          <span className="text-xs font-bold tracking-wide text-white">VECTO</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] font-medium"
                style={{
                  background: item.active ? "rgba(45, 98, 255, 0.15)" : "transparent",
                  color: item.active ? "#fff" : "rgba(255,255,255,0.45)",
                  borderLeft: item.active ? "2px solid #2D62FF" : "2px solid transparent",
                }}
              >
                <Icon
                  className="h-3 w-3 shrink-0"
                  style={{ color: item.active ? "#2D62FF" : undefined }}
                  aria-hidden
                />
                {item.label}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex items-center justify-between gap-2 border-b px-3 py-2 sm:px-4"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div>
            <p className="text-[10px] text-gray-500">Good morning</p>
            <p className="text-xs font-semibold text-white sm:text-sm">HR Dashboard</p>
          </div>
          <div
            className="hidden rounded-md px-2 py-1 text-[10px] text-gray-400 sm:block"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            May 2026 \u00b7 Week 20
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-hidden p-3 sm:p-4">
          <div className="grid grid-cols-3 gap-2">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg p-2 sm:p-2.5"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p className="truncate text-[9px] text-gray-500 sm:text-[10px]">{stat.label}</p>
                <p className="mt-0.5 text-sm font-bold text-white sm:text-base">{stat.value}</p>
                <p
                  className="mt-0.5 truncate text-[8px] sm:text-[9px]"
                  style={{ color: stat.color }}
                >
                  {stat.delta}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            <div
              className="rounded-lg p-2 sm:col-span-2 sm:p-3"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-medium text-white">Weekly hours</span>
                <BarChart3 className="h-3 w-3 text-[#2D62FF]" aria-hidden />
              </div>
              <div className="flex h-14 items-end gap-0.5 sm:h-16">
                {BARS.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t transition-all duration-700 ease-out"
                    style={{
                      height: isPlaying ? `${h}%` : `${Math.max(20, h * 0.65)}%`,
                      background: "linear-gradient(to top, #2D62FF, #7B61FF)",
                      opacity: isPlaying ? 1 : 0.7,
                      transitionDelay: isPlaying ? `${i * 40}ms` : "0ms",
                    }}
                  />
                ))}
              </div>
            </div>

            <div
              className="overflow-hidden rounded-lg sm:col-span-3"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                className="border-b px-2 py-1.5 text-[10px] font-medium text-white"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}
              >
                Team today
              </div>
              <div>
                {ROWS.map((row, i) => (
                  <div
                    key={row.name}
                    className="flex items-center justify-between gap-2 border-t px-2 py-1.5 transition-opacity duration-500"
                    style={{
                      borderColor: "rgba(255,255,255,0.04)",
                      opacity: isPlaying ? 1 : i === 0 ? 1 : 0.85,
                    }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-medium text-white">{row.name}</p>
                      <p className="truncate text-[9px] text-gray-500">{row.role}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-medium"
                      style={{
                        background: `${row.statusColor}22`,
                        color: row.statusColor,
                      }}
                    >
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
