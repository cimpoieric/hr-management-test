"use client";

import { EmployeeForm } from "@/components/employees/EmployeeForm";
import { useTranslation } from "@/hooks/useTranslation";

export default function NouAngajatPage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("pages.employeesNew.title")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("pages.employeesNew.subtitle")}
        </p>
      </div>

      <EmployeeForm />
    </div>
  );
}
