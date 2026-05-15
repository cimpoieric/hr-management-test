"use client";

import type { UserRole } from "@/lib/roles";
import type { AuthMeResponse } from "@/types";
import { usePathname, useRouter } from "next/navigation";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  organizationId?: string | null;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: AuthUser | null;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = (await res
        .json()
        .catch(() => null)) as AuthMeResponse | null;
      const u = data?.user;
      if (!u) {
        setUser(null);
        return;
      }
      setUser({
        id: String(u.id ?? ""),
        email: String(u.email ?? ""),
        name: u.name ?? null,
        role: u.role as UserRole,
        organizationId:
          u.organizationId != null ? String(u.organizationId) : null,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // keep user role/name in sync when navigating
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (user === null && !loading) {
      // token invalidated; send user to login if in app
      if (!pathname.startsWith("/login")) {
        router.push("/login");
      }
    }
  }, [user, loading, router, pathname]);

  const value = useMemo<AuthState>(
    () => ({ user, loading, refresh }),
    [user, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
