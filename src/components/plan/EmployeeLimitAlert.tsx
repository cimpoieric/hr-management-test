"use client";

import { usePlan } from "@/hooks/use-plan";
import { useTranslation } from "@/hooks/useTranslation";
import { ROUTES } from "@/lib/routes";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export function EmployeeLimitAlert() {
  const { t } = useTranslation();
  const {
    loading,
    remainingEmployees,
    maxEmployees,
    currentEmployees,
    plan,
  } = usePlan();

  if (loading || !plan) return null;
  if (remainingEmployees > 2) return null;

  const atLimit = remainingEmployees <= 0;

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
        atLimit
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
      role="status"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">
            {atLimit
              ? t("plan.employeeLimitTitle")
              : t("plan.employeeLimitWarningTitle")}
          </p>
          <p className="mt-0.5 text-xs opacity-90">
            {t("plan.employeeLimitBody", {
              current: currentEmployees,
              max: maxEmployees,
              remaining: remainingEmployees,
            })}
          </p>
        </div>
      </div>
      <Link
        href={ROUTES.pricing}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
          atLimit
            ? "bg-red-700 text-white hover:bg-red-800"
            : "bg-amber-700 text-white hover:bg-amber-800"
        }`}
      >
        {t("plan.upgradeCta")}
      </Link>
    </div>
  );
}
