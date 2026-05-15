"use client";

import { usePlan } from "@/hooks/use-plan";
import { useTranslation } from "@/hooks/useTranslation";
import type { PlanName } from "@/lib/plan-features";
import { ROUTES } from "@/lib/routes";
import { Loader2, Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function EmployeeLimitOverlay({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { loading, remainingEmployees, plan } = usePlan();

  if (loading) {
    return (
      <div className="relative min-h-[200px] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (remainingEmployees > 0) {
    return <>{children}</>;
  }

  const upgradePlan: PlanName = "BUSINESS";
  const planLabel = t(
    `organization.${upgradePlan.toLowerCase() as "business"}`,
    { defaultValue: upgradePlan },
  );

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm opacity-60" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-white/70 backdrop-blur-[2px] rounded-xl">
        <div className="max-w-md text-center rounded-2xl border bg-white shadow-lg p-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Lock size={22} aria-hidden />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            {t("plan.employeeLimitOverlayTitle")}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {t("plan.employeeLimitOverlayBody", { plan: planLabel })}
          </p>
          <Link
            href={ROUTES.pricing}
            className="mt-5 inline-flex rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {t("plan.upgradeCta")}
          </Link>
          {plan ? (
            <p className="mt-3 text-xs text-slate-400">
              {t("plan.currentPlanLabel", { plan })}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
