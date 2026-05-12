"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Bell,
  RefreshCw,
  LogOut,
  ChevronDown,
  UserCircle,
  ShieldCheck,
} from "lucide-react";
import { ro } from "@/messages";
import { ROUTES } from "@/lib/routes";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyLogo } from "@/hooks/useCompanyLogo";
import Link from "next/link";

type NotificationItem = {
  id: number;
  type: "warning" | "info" | "success";
  message: string;
  time: string;
  read: boolean;
};

function roleBadgeMeta(role: string | null) {
  if (role === "administrator") return { label: "administrator", cls: "bg-red-100 text-red-700" };
  if (role === "operator") return { label: "operator", cls: "bg-blue-100 text-blue-700" };
  if (role === "doar_vizualizare") return { label: "doar vizualizare", cls: "bg-gray-100 text-gray-700" };
  return { label: role ?? "—", cls: "bg-gray-100 text-gray-700" };
}

export function Header(_props?: { user?: unknown }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role } = useAuth();
  const { companyLogoUrl } = useCompanyLogo();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    { id: 1, type: "warning", message: "3 documente expirate necesită atenție.", time: "Acum 2 ore", read: false },
    { id: 2, type: "info", message: "Import nou în așteptare de aprobare.", time: "Acum 5 ore", read: false },
    { id: 3, type: "success", message: "Backup zilnic finalizat cu succes.", time: "Ieri, 22:10", read: true },
  ]);

  useEffect(() => {
    setDropdownOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    fetch("/api/notifications", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed"))))
      .then((data) => {
        if (Array.isArray(data.data)) {
          setNotifications(data.data as NotificationItem[]);
        }
      })
      .catch(() => {
        // fallback: păstrăm notificările mock locale
      });
  }, []);

  const notificationCount = notifications.filter((n) => !n.read).length;
  const roleMeta = useMemo(() => roleBadgeMeta(role), [role]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      // Fallback: redirect chiar dacă logout API eșuează
      router.push("/login");
    }
  }, [router]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [router]);

  return (
    <header className="h-14 bg-white border-b flex items-center justify-between px-4 lg:px-6 shrink-0">
      <div className="flex items-center min-w-0 flex-1 gap-2">
        {/* Spațiu sub butonul hamburger (fixed) pe mobil / tabletă */}
        <div className="w-8 shrink-0 lg:hidden" aria-hidden />
        {/* Branding când sidebar-ul e ascuns (sub lg) */}
        <div className="lg:hidden flex items-center min-w-0">
          <Link href={ROUTES.dashboard} className="flex items-center min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded">
            {companyLogoUrl ? (
              <img
                src={companyLogoUrl}
                alt="Logo firmă"
                className="max-h-10 w-auto max-w-[140px] object-contain shrink-0"
                decoding="async"
              />
            ) : (
              <span className="text-sm font-semibold text-gray-900 truncate">HR Manager</span>
            )}
          </Link>
        </div>
        {/* Titlu pagină — desktop */}
        <div className="hidden md:flex items-center text-sm text-gray-500 min-w-0">
          <span className="font-medium text-gray-900">{ro.nav.dashboard}</span>
        </div>
      </div>

      {/* Acțiuni dreapta */}
      <div className="flex items-center gap-2">
        {/* Refresh */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-50"
          title="Reîmprospătează datele"
        >
          <RefreshCw
            size={18}
            className={refreshing ? "animate-spin" : ""}
          />
        </button>

        {/* Notificări */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen((v) => !v)}
            className="relative p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title="Notificări"
          >
            <Bell size={18} />
            {notificationCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {notificationCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setNotificationsOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl border shadow-lg z-20 py-2">
                <div className="px-4 py-2 border-b flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">Notificări</p>
                  <span className="text-xs text-gray-500">{notificationCount} necitite</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.map((n) => (
                    <div key={n.id} className="px-4 py-3 border-b last:border-b-0">
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-1.5 inline-block w-2 h-2 rounded-full ${
                            n.type === "warning"
                              ? "bg-amber-500"
                              : n.type === "success"
                              ? "bg-green-500"
                              : "bg-blue-500"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{n.time}</p>
                        </div>
                      </div>
                      {!n.read && (
                        <button
                          type="button"
                          onClick={() =>
                            setNotifications((prev) =>
                              prev.map((item) =>
                                item.id === n.id ? { ...item, read: true } : item
                              )
                            )
                          }
                          className="mt-2 text-xs text-slate-600 hover:text-slate-900 underline"
                        >
                          Marchează ca citit
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User menu */}
        <div className="relative ml-2">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <UserCircle size={20} className="text-gray-400" />
            <span className="hidden sm:inline max-w-[120px] truncate">
              {user?.email ? user.email.split("@")[0] : "—"}
            </span>
            <span className={`hidden sm:inline text-[11px] font-semibold px-2 py-0.5 rounded-full ${roleMeta.cls}`}>
              {roleMeta.label}
            </span>
            <ChevronDown
              size={14}
              className={`text-gray-400 transition-transform ${
                dropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {dropdownOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />

              {/* Dropdown */}
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl border shadow-lg z-20 py-1">
                {/* User info */}
                <div className="px-4 py-3 border-b">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.email ?? "—"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <ShieldCheck size={12} className="text-amber-500" />
                    <span className={`text-xs font-semibold tracking-wide px-2 py-0.5 rounded-full ${roleMeta.cls}`}>
                      {roleMeta.label}
                    </span>
                  </div>
                </div>

                {/* Acțiuni */}
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={16} />
                  <span>Deconectare</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
