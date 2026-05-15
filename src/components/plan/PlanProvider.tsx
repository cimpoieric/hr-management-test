"use client";

import { useAuth } from "@/hooks/useAuth";
import { clientCanUseFeature } from "@/lib/plan-ui";
import type { FirmPlanApiSummary } from "@/types/plan";
import { FEATURES, type PlanFeature } from "@/lib/plan-features";
import type { PlanName } from "@/lib/plan-features";
import type { PricingPlanId } from "@/lib/pricingPlans";
import { UserRole } from "@/lib/roles";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type UsePlanValue = {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  plan: PlanName | null;
  planKey: PricingPlanId | null;
  maxEmployees: number;
  currentEmployees: number;
  remainingEmployees: number;
  features: string[];
  isTrial: boolean;
  isSubscriptionActive: boolean;
  trialDaysRemaining: number | null;
  canUseFeature: (feature: PlanFeature | string) => boolean;
  raw: FirmPlanApiSummary | null;
};

const PlanContext = createContext<UsePlanValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user, role, loading: authLoading } = useAuth();
  const [raw, setRaw] = useState<FirmPlanApiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSuperAdmin = role === UserRole.SUPER_ADMIN;

  const refresh = useCallback(async () => {
    if (!user || isSuperAdmin) {
      setRaw(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/firm/plan", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) {
        setRaw(null);
        setError("plan_fetch_failed");
        return;
      }
      const data = (await res.json()) as { plan?: FirmPlanApiSummary };
      setRaw(data.plan ?? null);
    } catch {
      setRaw(null);
      setError("plan_fetch_failed");
    } finally {
      setLoading(false);
    }
  }, [user, isSuperAdmin]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  const value = useMemo((): UsePlanValue => {
    const features = isSuperAdmin
      ? [FEATURES.UNLIMITED]
      : (raw?.effectiveFeatures ?? []);

    return {
      loading: authLoading || loading,
      error,
      refresh,
      plan: isSuperAdmin ? "CUSTOM" : (raw?.planName ?? null),
      planKey: isSuperAdmin ? "custom" : (raw?.planKey ?? null),
      maxEmployees: isSuperAdmin ? 999_999 : (raw?.maxEmployees ?? 0),
      currentEmployees: raw?.employeeCount ?? 0,
      remainingEmployees: isSuperAdmin
        ? 999_999
        : (raw?.remainingEmployees ?? 0),
      features,
      isTrial: raw?.subscriptionStatus === "trial",
      isSubscriptionActive: isSuperAdmin || (raw?.isSubscriptionActive ?? true),
      trialDaysRemaining: raw?.trialDaysRemaining ?? null,
      canUseFeature: (feature) => {
        if (isSuperAdmin) return true;
        return clientCanUseFeature(features, feature);
      },
      raw,
    };
  }, [authLoading, loading, error, refresh, raw, isSuperAdmin]);

  return (
    <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
  );
}

export function usePlanContext(): UsePlanValue {
  const ctx = useContext(PlanContext);
  if (!ctx) {
    throw new Error("usePlan must be used within PlanProvider");
  }
  return ctx;
}
