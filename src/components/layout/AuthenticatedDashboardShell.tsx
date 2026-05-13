/**
 * Shell HR (sidebar + header + zonă principală) cu verificare JWT în Server Component.
 */

import { DashboardShellFrame } from "@/components/layout/DashboardShellFrame";
import { type AuthContext, verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function getAuthUser(): Promise<AuthContext | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;
    if (!token) return null;
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export async function AuthenticatedDashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardShellFrame
      initialUser={{
        id: String(user.userId),
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      }}
    >
      {children}
    </DashboardShellFrame>
  );
}
