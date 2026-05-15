import AdminCountriesPageClient from "./AdminCountriesPageClient";
import { requireSuperAdmin } from "@/lib/dashboardSession";

export default async function AdminCountriesPage() {
  await requireSuperAdmin();
  return <AdminCountriesPageClient />;
}
