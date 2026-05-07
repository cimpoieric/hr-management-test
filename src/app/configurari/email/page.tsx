import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { AuthenticatedDashboardShell } from "@/components/layout/AuthenticatedDashboardShell";
import EmailSettingsClient from "./EmailSettingsClient";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;
    if (!token) return null;
    const user = await verifyToken(token);
    return canManageUsers(user.role) ? user : null;
  } catch {
    return null;
  }
}

export default async function EmailConfigurariPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/login");
  }

  return (
    <AuthenticatedDashboardShell>
      <EmailSettingsClient />
    </AuthenticatedDashboardShell>
  );
}

