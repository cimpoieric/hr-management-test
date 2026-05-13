"use client";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { ROUTES } from "@/lib/routes";
import { Factory, Globe2, Shield } from "lucide-react";
import Link from "next/link";

export default function OrganizationPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("organization.title")}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {t("pages.organization.subtitle")}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          variant="outline"
          className="h-auto justify-start gap-3 py-4"
          asChild
        >
          <Link href={ROUTES.companies}>
            <Factory className="h-5 w-5 shrink-0" />
            <span className="text-left font-medium">
              {t("pages.organization.companies")}
            </span>
          </Link>
        </Button>
        <Button
          variant="outline"
          className="h-auto justify-start gap-3 py-4"
          asChild
        >
          <Link href={ROUTES.countries}>
            <Globe2 className="h-5 w-5 shrink-0" />
            <span className="text-left font-medium">
              {t("pages.organization.countries")}
            </span>
          </Link>
        </Button>
        <Button
          variant="outline"
          className="h-auto justify-start gap-3 py-4"
          asChild
        >
          <Link href={ROUTES.users}>
            <Shield className="h-5 w-5 shrink-0" />
            <span className="text-left font-medium">
              {t("pages.organization.users")}
            </span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
