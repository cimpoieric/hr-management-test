import "server-only";

import { AsyncLocalStorage } from "async_hooks";
import type { AuthContext } from "@/lib/auth";

export type TenantRequestContext = {
  organizationId: string;
  userId: string;
  email: string;
  role: string;
};

const tenantRequestStorage = new AsyncLocalStorage<TenantRequestContext>();

const tenantBypassStorage = new AsyncLocalStorage<boolean>();

export function getTenantRequestContext(): TenantRequestContext | undefined {
  return tenantRequestStorage.getStore();
}

export function isTenantBypassActive(): boolean {
  return tenantBypassStorage.getStore() === true;
}

export function runWithTenantContext<T>(
  ctx: TenantRequestContext,
  fn: () => Promise<T>,
): Promise<T> {
  return tenantRequestStorage.run(ctx, fn);
}

export function runWithoutTenantEnforcement<T>(
  fn: () => Promise<T>,
): Promise<T> {
  return tenantBypassStorage.run(true, fn);
}

/** After successful verifyAuth: store tenant in ALS for the rest of the request. */
export function enterTenantContextFromAuth(auth: AuthContext): void {
  tenantRequestStorage.enterWith({
    organizationId: auth.organizationId,
    userId: auth.userId,
    email: auth.email,
    role: auth.role,
  });
}

/**
 * Server Actions: wrap handler in runWithTenantContext after verifyAuth.
 * tRPC: set the same context in createContext from cookie/JWT before prisma.
 */
