import AdminSettingsPageClient from "./AdminSettingsPageClient";
import { requireSuperAdmin } from "@/lib/dashboardSession";

export default async function AdminSettingsPage() {
  await requireSuperAdmin();
  return <AdminSettingsPageClient />;
}
