import AdminBackupPageClient from "./AdminBackupPageClient";
import { requireSuperAdmin } from "@/lib/dashboardSession";

export default async function AdminBackupPage() {
  await requireSuperAdmin();
  return <AdminBackupPageClient />;
}
