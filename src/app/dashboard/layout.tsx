/**
 * Layout pentru ruta canonică /dashboard (aceeași zonă autentificată ca grupul (dashboard)).
 */

import { AuthenticatedDashboardShell } from "@/components/layout/AuthenticatedDashboardShell";

export default function DashboardSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedDashboardShell>{children}</AuthenticatedDashboardShell>;
}
