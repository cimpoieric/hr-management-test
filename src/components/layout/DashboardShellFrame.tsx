"use client";

import type { ReactNode } from "react";
import { AuthProvider, type AuthUser } from "@/components/auth/AuthProvider";
import { PlanProvider } from "@/components/plan/PlanProvider";
import { Header } from "@/components/layout/Header";
import { MainContent } from "@/components/layout/MainContent";
import { Sidebar } from "@/components/layout/Sidebar";

export function DashboardShellFrame({
  initialUser,
  children,
}: {
  initialUser: AuthUser;
  children: ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen min-h-dvh bg-gray-50"
      suppressHydrationWarning
    >
      <AuthProvider initialUser={initialUser}>
        <PlanProvider>
          <Sidebar />
          <div className="flex flex-col flex-1 min-w-0 min-h-0">
            <Header />
            <MainContent>{children}</MainContent>
          </div>
        </PlanProvider>
      </AuthProvider>
    </div>
  );
}
