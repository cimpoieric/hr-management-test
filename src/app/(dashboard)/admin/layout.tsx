import { requireSuperAdmin } from "@/lib/dashboardSession";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();
  return children;
}
