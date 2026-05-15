"use client";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { ROUTES } from "@/lib/routes";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-4 py-16">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <AlertTriangle className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">
          {t("error.title")}
        </h1>
        <p className="text-sm text-slate-600">{t("error.description")}</p>
        {process.env.NODE_ENV === "development" && (
          <pre className="max-h-32 w-full overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-left text-xs text-red-800">
            {error.message}
          </pre>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" variant="outline" onClick={reset}>
          {t("error.retry")}
        </Button>
        <Button type="button" asChild>
          <Link href={ROUTES.dashboard}>{t("error.goToDashboard")}</Link>
        </Button>
      </div>
    </div>
  );
}
