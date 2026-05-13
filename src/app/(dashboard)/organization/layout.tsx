import {
  guardDashboardRoles,
  requireDashboardSession,
} from "@/lib/dashboardSession";
import { UserRole } from "@/lib/roles";

export default async function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireDashboardSession();
  guardDashboardRoles(session, [UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN], {
    superAdminBypass: false,
  });
  return children;
}
