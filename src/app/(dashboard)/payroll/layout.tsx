import {
  guardDashboardRoles,
  requireDashboardSession,
} from "@/lib/dashboardSession";
import { ROLES_PAYROLL } from "@/lib/roles";

export default async function PayrollLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireDashboardSession();
  guardDashboardRoles(session, ROLES_PAYROLL);
  return children;
}
