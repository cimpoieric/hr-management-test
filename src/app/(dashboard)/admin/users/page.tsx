import AdminUsersPageClient from "./AdminUsersPageClient";
import { requireSuperAdmin } from "@/lib/dashboardSession";

export default async function AdminUsersPage() {
  await requireSuperAdmin();
  return <AdminUsersPageClient />;
}
