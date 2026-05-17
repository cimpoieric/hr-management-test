import AdminCreateOrganizationPageClient from "./AdminCreateOrganizationPageClient";
import { requireSuperAdmin } from "@/lib/dashboardSession";

export default async function AdminCreateOrganizationPage() {
  await requireSuperAdmin();
  return <AdminCreateOrganizationPageClient />;
}
