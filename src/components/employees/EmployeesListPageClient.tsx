"use client";

import { ROLES_EMPLOYEES_RW } from "@/lib/roles";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { EmployeeTable } from "@/components/employees/EmployeeTable";
import { useTranslation } from "@/hooks/useTranslation";
import { ROUTES } from "@/lib/routes";
import type { EmployeeKpiStats } from "@/lib/employeeStats";
import type { CompanyOption, CountryOption } from "@/types";
import { Plus } from "lucide-react";
import Link from "next/link";

export function EmployeesListPageClient({
  companies,
  countries,
  canonicalKpi,
}: {
  companies: CompanyOption[];
  countries: CountryOption[];
  canonicalKpi: EmployeeKpiStats;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("employees.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("pages.employeesList.subtitle")}
          </p>
        </div>
        <PermissionGuard allowedRoles={ROLES_EMPLOYEES_RW}>
          <Link
            href={ROUTES.employeesNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">
              {t("employees.addEmployee")}
            </span>
          </Link>
        </PermissionGuard>
      </div>

      <EmployeeTable
        companies={companies}
        countries={countries}
        showAdvancedFilters
        showBulkActions
        canonicalKpi={canonicalKpi}
      />
    </div>
  );
}
