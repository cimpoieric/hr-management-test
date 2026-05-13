import {
  guardDashboardRoles,
  requireDashboardSession,
} from "@/lib/dashboardSession";
import { ROLES_EMPLOYEES_RW } from "@/lib/roles";

export default async function DeploymentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireDashboardSession();
  guardDashboardRoles(session, ROLES_EMPLOYEES_RW);
  return children;
}
