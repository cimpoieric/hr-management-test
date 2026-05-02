/**
 * Layout pentru redirect-ul /dashboard → /panou-de-control (aceeași zonă ca grupul (dashboard)).
 */

import { AuthenticatedDashboardShell } from "@/components/layout/AuthenticatedDashboardShell";

export default function DashboardSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedDashboardShell>{children}</AuthenticatedDashboardShell>;
}
