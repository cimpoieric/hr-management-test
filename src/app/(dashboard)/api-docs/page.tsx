"use client";

import { usePlan } from "@/hooks/use-plan";
import { useTranslation } from "@/hooks/useTranslation";
import { FEATURES } from "@/lib/plan-features";
import { ROUTES } from "@/lib/routes";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ApiDocsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { canUseFeature, loading } = usePlan();

  useEffect(() => {
    if (loading) return;
    if (!canUseFeature(FEATURES.API_ACCESS)) {
      router.replace(
        `${ROUTES.pricing}?reason=api_access&message=${encodeURIComponent(t("plan.apiDocsRedirect"))}`,
      );
    }
  }, [canUseFeature, loading, router, t]);

  if (loading || !canUseFeature(FEATURES.API_ACCESS)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        <Loader2 size={28} className="animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">
        {t("plan.apiDocsTitle")}
      </h1>
      <p className="text-sm text-gray-600">{t("plan.apiDocsBody")}</p>
    </div>
  );
}
