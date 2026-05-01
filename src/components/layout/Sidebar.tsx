"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  MapPin,
  Download,
  BarChart3,
  FileSpreadsheet,
  Settings,
  Shield,
  Database,
  Menu,
  X,
} from "lucide-react";
import type { UserRole } from "@/lib/auth";

interface RouteItem {
  href: string;
  label: string;
  icon: React.ElementType;
  adminOnly: boolean;
}

const routes: RouteItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/angajati", label: "Angajați", icon: Users, adminOnly: false },
  { href: "/documente", label: "Documente", icon: FileText, adminOnly: false },
  { href: "/detasari", label: "Detașări", icon: MapPin, adminOnly: false },
  { href: "/importuri-in-asteptare", label: "Importuri", icon: Download, adminOnly: false },
  { href: "/rapoarte", label: "Rapoarte", icon: BarChart3, adminOnly: false },
  { href: "/export", label: "Export", icon: FileSpreadsheet, adminOnly: false },
  { href: "/setari", label: "Setări", icon: Settings, adminOnly: true },
  { href: "/utilizatori", label: "Utilizatori", icon: Shield, adminOnly: true },
  { href: "/backup", label: "Backup", icon: Database, adminOnly: true },
];

function SidebarNav({
  userRole: _userRole,
  isAdmin,
  onNavigate,
}: {
  userRole: UserRole;
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const visibleRoutes = routes.filter((r) => !r.adminOnly || isAdmin);

  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {visibleRoutes.map((route) => {
        const isActive =
          route.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(route.href);

        return (
          <Link
            key={route.href}
            href={route.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <route.icon size={18} />
            <span>{route.label}</span>
            {route.adminOnly && (
              <span className="ml-auto text-[10px] uppercase tracking-wider text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                Admin
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({
  userRole,
  isAdmin,
}: {
  userRole: UserRole;
  isAdmin: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-900 text-white shadow-lg"
        aria-label="Deschide meniul"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transform transition-transform duration-200 lg:transform-none ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-slate-900 font-bold text-sm">HR</span>
            </div>
            <span className="font-semibold text-lg tracking-tight">
              Manager
            </span>
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Închide meniul"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <SidebarNav
          userRole={userRole}
          isAdmin={isAdmin}
          onNavigate={() => setIsOpen(false)}
        />

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 text-xs text-slate-500">
          HR Manager v0.1.0
        </div>
      </aside>
    </>
  );
}
