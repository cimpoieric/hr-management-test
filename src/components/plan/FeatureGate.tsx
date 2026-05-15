"use client";

import { usePlan } from "@/hooks/use-plan";
import type { PlanFeature } from "@/lib/plan-features";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { UpgradePrompt } from "./UpgradePrompt";

type FeatureGateProps = {
  feature: PlanFeature | string;
  children: ReactNode;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
};

export function FeatureGate({
  feature,
  children,
  fallback,
  loadingFallback,
}: FeatureGateProps) {
  const { canUseFeature, loading } = usePlan();

  if (loading) {
    return (
      loadingFallback ?? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 size={24} className="animate-spin" aria-hidden />
        </div>
      )
    );
  }

  if (!canUseFeature(feature)) {
    return fallback ?? <UpgradePrompt feature={feature} />;
  }

  return <>{children}</>;
}
