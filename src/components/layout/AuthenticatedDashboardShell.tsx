/**
 * Shell HR (sidebar + header + zonă principală) cu verificare JWT în Server Component.
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken, type AuthContext } from "@/lib/auth";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MainContent } from "@/components/layout/MainContent";

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
    <div className="flex min-h-screen min-h-dvh bg-gray-50">
      <AuthProvider
        initialUser={{
          id: user.userId,
          email: user.email,
          role: user.role,
        }}
      >
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <Header user={user} />
          <MainContent>{children}</MainContent>
        </div>
      </AuthProvider>
    </div>
  );
}
