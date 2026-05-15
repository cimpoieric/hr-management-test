/**
 * Multi-tenant: public API paths, headers for middleware, and withTenant helper.
 * Edge-safe (no Node-only APIs) - safe to import from root middleware.ts.
 */

/** Header set by middleware from verified JWT (not from client). */
export const HEADER_ORGANIZATION_ID = "x-organization-id";
export const HEADER_USER_ID = "x-user-id";
export const HEADER_USER_ROLE = "x-user-role";

/** API paths that skip mandatory tenant in middleware (public auth + setup). */
const PUBLIC_API_EXACT = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/register-organization",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/setup",
  "/api/stripe/webhook",
  "/api/webhooks/stripe",
]);

const PUBLIC_API_PREFIXES = ["/api/auth/register/"] as const;

export function isPublicApiPath(pathname: string): boolean {
  if (PUBLIC_API_EXACT.has(pathname)) return true;
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

/** Paths where Prisma tenant isolation must not require organizationId yet. */
export function isPublicTenantBypassPath(pathname: string): boolean {
  if (pathname === "/setup") return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname === "/api/setup") return true;
  if (pathname === "/login" || pathname.startsWith("/register")) return true;
  return false;
}

export type WhereInput = Record<string, unknown>;

/**
 * Merge an existing Prisma `where` with a required clause (e.g. organizationId).
 */
export function mergeWhere(existing: unknown, clause: WhereInput): WhereInput {
  if (
    existing == null ||
    typeof existing !== "object" ||
    Array.isArray(existing)
  ) {
    return clause;
  }
  const w = existing as WhereInput;
  if (Array.isArray(w.AND)) {
    return { ...w, AND: [...w.AND, clause] };
  }
  return { AND: [w, clause] };
}

type HasWhere = { where?: unknown };

/**
 * Add `where: { organizationId: orgId }` to Prisma args (manual queries).
 */
export function withTenant<T extends HasWhere>(
  query: T,
  organizationId: string,
): T {
  return {
    ...query,
    where: mergeWhere(query.where, { organizationId }),
  } as T;
}
