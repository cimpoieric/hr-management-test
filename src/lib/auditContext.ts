import "server-only";

/**
 * Audit Context — Shared AsyncLocalStorage pentru propagarea
 * informațiilor despre userul curent între rute și Prisma middleware.
 *
 * NOTA: Acest modul este server-only și nu trebuie importat din client components.
 * Folosit doar în API routes, server components, și Prisma middleware.
 *
 * Acest modul este independent pentru a preveni circular dependencies
 * între audit.ts și prisma.ts.
 */

import { AsyncLocalStorage } from "async_hooks";
import type { NextRequest } from "next/server";

export interface AuditContextData {
  userId: number;
  userName: string;
  userRole: string;
  ipAddress: string;
  userAgent?: string;
}

/** Storage async-local — propagă contextul de audit prin call stack */
export const auditStorage = new AsyncLocalStorage<AuditContextData>();

/** Extrage IP din request */
export function getClientIp(request: NextRequest | Headers): string {
  let headers: Headers;
  if (request instanceof Headers) {
    headers = request;
  } else {
    headers = request.headers;
  }
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Setează contextul audit pentru request-ul curent */
export function setAuditContext(
  request: NextRequest,
  userId: number,
  userName: string,
  userRole: string
): void {
  auditStorage.enterWith({
    userId,
    userName,
    userRole,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
  });
}

/** Curăță contextul */
export function clearAuditContext(): void {
  auditStorage.disable();
}

/** Verifică dacă există context audit activ */
export function hasAuditContext(): boolean {
  return auditStorage.getStore() !== undefined;
}
