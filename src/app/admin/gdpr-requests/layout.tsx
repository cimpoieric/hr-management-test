import { requireAuditLogsViewer } from "@/lib/dashboardSession";
import { AuthenticatedDashboardShell } from "@/components/layout/AuthenticatedDashboardShell";

export default async function AdminGdprRequestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuditLogsViewer();
  return <AuthenticatedDashboardShell>{children}</AuthenticatedDashboardShell>;
}
