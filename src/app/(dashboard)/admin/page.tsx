import GlobalAdminPageClient from "./GlobalAdminPageClient";
import { requireSuperAdmin } from "@/lib/dashboardSession";

export default async function AdminPage() {
  await requireSuperAdmin();
  return <GlobalAdminPageClient />;
}
