import { AuthenticatedDashboardShell } from "@/components/layout/AuthenticatedDashboardShell";

export default function EmployeeDataExportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedDashboardShell>{children}</AuthenticatedDashboardShell>;
}
