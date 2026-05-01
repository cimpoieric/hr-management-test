/**
 * Layout protejat pentru rutele din grupul (dashboard) — URL-uri la rădăcină (/angajati, …).
 */

import { AuthenticatedDashboardShell } from "@/components/layout/AuthenticatedDashboardShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedDashboardShell>{children}</AuthenticatedDashboardShell>;
}
