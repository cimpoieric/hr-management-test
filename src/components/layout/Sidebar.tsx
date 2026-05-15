"use client";

import { PlanBadge } from "@/components/plan/PlanBadge";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/use-plan";
import { useCompanyLogo } from "@/hooks/useCompanyLogo";
import { useTranslation } from "@/hooks/useTranslation";
import { minPlanForFeature } from "@/lib/plan-ui";
import { ROUTES } from "@/lib/routes";
import { isJwtRoleIn, UserRole } from "@/lib/roles";
import { Lock, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  isNavActive,
  ORG_ADMIN_SIDEBAR_HREFS_WITH_ADMIN_BADGE,
  SIDEBAR_ROUTE_DEFS,
  SUPER_ADMIN_SIDEBAR_ROUTE_DEFS,
} from "./navConfig";

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { role } = useAuth();
  const { canUseFeature, loading: planLoading } = usePlan();
  const { t } = useTranslation();

  const visibleRoutes = useMemo(() => {
    if (!role) return [];

    const isSuperAdmin = role === UserRole.SUPER_ADMIN;
    const baseRoutes = SIDEBAR_ROUTE_DEFS.filter((route) => {
      if (isSuperAdmin && ORG_ADMIN_SIDEBAR_HREFS_WITH_ADMIN_BADGE.has(route.href)) {
        return false;
      }
      if (!route.rolesAllowed?.length) return true;
      return isJwtRoleIn({ role: role as UserRole }, route.rolesAllowed, {
        superAdminBypass: false,
      });
    });

    return isSuperAdmin
      ? [...baseRoutes, ...SUPER_ADMIN_SIDEBAR_ROUTE_DEFS]
      : baseRoutes;
  }, [role]);

  return (
    <nav className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-3 py-3 lg:py-4 space-y-1">
      {visibleRoutes.map((route) => {
        const isActive = isNavActive(pathname, route.href);
        const locked =
          route.planFeature &&
          !planLoading &&
          !canUseFeature(route.planFeature);
        const requiredPlan = route.planFeature
          ? minPlanForFeature(route.planFeature)
          : null;
        const lockTitle =
          locked && requiredPlan
            ? t("plan.navLockTooltip", { plan: requiredPlan })
            : undefined;

        return (
          <Link
            key={route.href}
            href={route.href}
            onClick={onNavigate}
            title={lockTitle}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            } ${locked ? "opacity-80" : ""}`}
          >
            <route.icon size={18} />
            <span>{t(route.i18nKey)}</span>
            {locked ? (
              <Lock
                size={14}
                className="ml-auto shrink-0 text-amber-400/90"
                aria-label={lockTitle}
              />
            ) : null}
            {route.showAdminBadge && !locked ? (
              <span className="ml-auto text-[10px] uppercase tracking-wider text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                {t("components.layout.sidebarAdminBadge")}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({}: {}) {
  const [isOpen, setIsOpen] = useState(false);
  const { companyLogoUrl } = useCompanyLogo();
  const { t } = useTranslation();

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-900 text-white shadow-lg"
        aria-label={t("components.layout.sidebarOpenMenu")}
        suppressHydrationWarning
        type="button"
      >
        <Menu size={20} />
      </button>

      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden
        />
      )}

      <aside
        suppressHydrationWarning
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col min-h-0 h-dvh lg:h-dvh transform transition-transform duration-200 lg:transform-none ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <Link
            href={ROUTES.dashboard}
            className="flex items-center gap-2.5 min-w-0"
            onClick={() => setIsOpen(false)}
          >
            {companyLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic logo URL from API
              <img
                src={companyLogoUrl}
                alt={t("components.layout.sidebarLogoAlt")}
                className="max-h-10 w-auto max-w-[200px] object-contain shrink-0"
                decoding="async"
              />
            ) : (
              <>
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0">
                  <span
                    className="text-slate-900 font-bold text-sm"
                    suppressHydrationWarning
                  >
                    {t("components.layout.sidebarBrandInitials")}
                  </span>
                </div>
                <span
                  className="font-semibold text-lg tracking-tight truncate"
                  suppressHydrationWarning
                >
                  {t("components.layout.sidebarFallbackProductName")}
                </span>
              </>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label={t("components.layout.sidebarCloseMenu")}
            suppressHydrationWarning
          >
            <X size={18} />
          </button>
        </div>

        <SidebarNav onNavigate={() => setIsOpen(false)} />

        <div
          suppressHydrationWarning
          className="shrink-0 px-5 py-3 border-t border-slate-800 space-y-2"
        >
          <PlanBadge showTrial />
          <p className="text-xs text-slate-500">
            {t("components.layout.sidebarFooterVersion")}
          </p>
        </div>
      </aside>
    </>
  );
}
