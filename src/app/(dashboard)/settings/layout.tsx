import {
  guardDashboardRoles,
  requireDashboardSession,
} from "@/lib/dashboardSession";
import { ROLES_SETTINGS_ADMIN } from "@/lib/roles";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireDashboardSession();
  guardDashboardRoles(session, ROLES_SETTINGS_ADMIN);
  return children;
}
