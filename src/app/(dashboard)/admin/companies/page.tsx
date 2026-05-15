import AdminCompaniesPageClient from "./AdminCompaniesPageClient";
import { requireSuperAdmin } from "@/lib/dashboardSession";

export default async function AdminCompaniesPage() {
  await requireSuperAdmin();
  return <AdminCompaniesPageClient />;
}
