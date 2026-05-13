/**
 * Layout protejat pentru grupul (dashboard) — shell cu sidebar.
 */

import { AuthenticatedDashboardShell } from "@/components/layout/AuthenticatedDashboardShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedDashboardShell>{children}</AuthenticatedDashboardShell>;
}
