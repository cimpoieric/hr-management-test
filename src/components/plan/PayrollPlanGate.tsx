"use client";

import { usePlan } from "@/hooks/use-plan";
import { FEATURES } from "@/lib/plan-features";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { UpgradePrompt } from "./UpgradePrompt";

export function PayrollPlanGate({ children }: { children: ReactNode }) {
  const { canUseFeature, loading } = usePlan();

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (!canUseFeature(FEATURES.PAYROLL_SLIPS)) {
    return <UpgradePrompt feature={FEATURES.PAYROLL_SLIPS} fullPage />;
  }

  return <>{children}</>;
}
