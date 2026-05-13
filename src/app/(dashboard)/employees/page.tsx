import { EmployeesListPageClient } from "@/components/employees/EmployeesListPageClient";
import { getEmployeeStats } from "@/lib/employeeStats";
import { prisma } from "@/lib/prisma";

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
    <EmployeesListPageClient
      companies={companies}
      countries={countries}
      canonicalKpi={canonicalKpi}
    />
  );
}
