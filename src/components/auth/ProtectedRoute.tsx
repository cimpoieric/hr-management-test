"use client";

import { useAuth } from "@/hooks/useAuth";
import { UserRole, isJwtRoleIn } from "@/lib/roles";
import { ROUTES } from "@/lib/routes";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ProtectedRoute({
  requiredRoles,
  children,
}: {
  requiredRoles: UserRole[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { role, loading } = useAuth();

  const allowed = Boolean(role && isJwtRoleIn({ role }, requiredRoles));

  useEffect(() => {
    if (loading) return;
    if (!role) return;
    if (allowed) return;

    if (role !== UserRole.EMPLOYEE) {
      router.replace(ROUTES.dashboard);
    }
  }, [allowed, loading, role, router]);

  if (loading) return null;
  if (!role) return null;
  if (allowed) return children;

  if (role === UserRole.EMPLOYEE) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        Acces interzis
      </div>
    );
  }

  return null;
}
