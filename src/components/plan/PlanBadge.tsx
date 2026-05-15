"use client";

import { usePlan } from "@/hooks/use-plan";
import { useTranslation } from "@/hooks/useTranslation";
import { PLAN_BADGE_STYLES } from "@/lib/plan-ui";
import type { PlanName } from "@/lib/plan-features";
import { Loader2 } from "lucide-react";

type PlanBadgeProps = {
  className?: string;
  showTrial?: boolean;
};

export function PlanBadge({ className = "", showTrial = true }: PlanBadgeProps) {
  const { t } = useTranslation();
  const {
    plan,
    loading,
    isTrial,
    trialDaysRemaining,
    remainingEmployees,
    maxEmployees,
    currentEmployees,
  } = usePlan();

  if (loading) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500 ${className}`}
      >
        <Loader2 size={12} className="animate-spin" aria-hidden />
      </span>
    );
  }

  if (!plan) return null;

  const styles = PLAN_BADGE_STYLES[plan as PlanName] ?? PLAN_BADGE_STYLES.STARTER;
  const planLabel = t(
    `organization.${plan.toLowerCase() as "starter" | "business" | "enterprise" | "custom"}`,
    { defaultValue: plan },
  );

  return (
    <span
      className={`inline-flex flex-col items-end gap-0.5 ${className}`}
      title={t("plan.badgeTooltip", {
        current: currentEmployees,
        max: maxEmployees,
        remaining: remainingEmployees,
      })}
    >
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles.bg} ${styles.text} ${styles.border}`}
      >
        {planLabel}
      </span>
      {showTrial && isTrial && trialDaysRemaining != null ? (
        <span className="text-[10px] text-amber-600 font-medium">
          {t("plan.trialDaysLeft", { days: trialDaysRemaining })}
        </span>
      ) : null}
    </span>
  );
}
