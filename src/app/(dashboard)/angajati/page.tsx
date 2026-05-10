import Link from "next/link";
import { Plus } from "lucide-react";
import { EmployeeTable } from "@/components/employees/EmployeeTable";
import { prisma } from "@/lib/prisma";
import { getEmployeeStats } from "@/lib/employeeStats";
import { PermissionGuard } from "@/components/auth/PermissionGuard";

export const dynamic = "force-dynamic";

export default async function AngajatiPage() {
  // Fetch companies server-side for the filter dropdown
  const [companies, countries, canonicalKpi] = await Promise.all([
    prisma.company.findMany({
      where: { status: "Activ" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.country.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    getEmployeeStats(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Angajați</h1>
          <p className="text-sm text-gray-500 mt-1">
            Management angajați — căutare, filtrare, export
          </p>
        </div>
        <PermissionGuard allowedRoles={["operator", "administrator"]}>
          <Link
            href="/angajati/nou"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Adaugă angajat</span>
          </Link>
        </PermissionGuard>
      </div>

      {/* Tabel cu filtre avansate și selecție bulk */}
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
