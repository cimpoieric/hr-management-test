"use client";

import { useTranslation } from "@/hooks/useTranslation";
import {
  featureLabelKey,
  minPlanForFeature,
  PLAN_BADGE_STYLES,
} from "@/lib/plan-ui";
import type { PlanFeature } from "@/lib/plan-features";
import { ROUTES } from "@/lib/routes";
import { ArrowUpRight, Lock, Sparkles } from "lucide-react";
import Link from "next/link";

type UpgradePromptProps = {
  feature: PlanFeature | string;
  className?: string;
  fullPage?: boolean;
};

export function UpgradePrompt({
  feature,
  className = "",
  fullPage = false,
}: UpgradePromptProps) {
  const { t } = useTranslation();
  const requiredPlan = minPlanForFeature(feature);
  const styles = PLAN_BADGE_STYLES[requiredPlan];
  const featureName = t(featureLabelKey(feature), {
    defaultValue: feature.replace(/_/g, " "),
  });
  const planLabel = t(
    `organization.${requiredPlan.toLowerCase() as "starter" | "business" | "enterprise"}`,
    { defaultValue: requiredPlan },
  );

  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br from-white via-slate-50 to-blue-50/40 shadow-sm overflow-hidden ${fullPage ? "min-h-[320px] flex flex-col justify-center" : ""} ${className}`}
    >
      <div className="p-8 sm:p-10 text-center max-w-lg mx-auto">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
          <Lock size={26} aria-hidden />
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${styles.bg} ${styles.text} ${styles.border}`}
        >
          <Sparkles size={12} aria-hidden />
          {planLabel}
        </span>
        <h2 className="mt-4 text-xl font-bold text-slate-900">
          {t("plan.upgradeTitle")}
        </h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          {t("plan.upgradeBody", { feature: featureName, plan: planLabel })}
        </p>
        <Link
          href={ROUTES.pricing}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
        >
          {t("plan.upgradeCta")}
          <ArrowUpRight size={16} aria-hidden />
        </Link>
        <p className="mt-4 text-xs text-slate-400">{t("plan.upgradeHint")}</p>
      </div>
    </div>
  );
}
