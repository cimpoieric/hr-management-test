/**
 * Edge-safe subscription gate helpers for root middleware.
 */

export const SUBSCRIPTION_EXPIRED_BODY = {
  error: "Abonament expirat",
  redirect: "/pricing",
} as const;

export const HEADER_TRIAL_ENDING = "x-trial-ending";

const FIRM_BILLING_API_PREFIX = "/api/firm/";

const SUBSCRIPTION_EXEMPT_API_EXACT = new Set([
  "/api/internal/subscription-gate",
  "/api/firm/plan",
  "/api/firm/upgrade",
  "/api/firm/start-trial",
  "/api/firm/usage",
  "/api/stripe/checkout",
  "/api/stripe/portal",
  "/api/stripe/subscription",
  "/api/stripe/webhook",
  "/api/webhooks/stripe",
  "/api/setup",
]);

const SUBSCRIPTION_EXEMPT_API_PREFIXES = [
  "/api/auth/",
  "/api/admin/",
  "/api/internal/",
] as const;

const SUBSCRIPTION_EXEMPT_PAGES = new Set([
  "/pricing",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/setup",
  "/privacy",
  "/terms",
]);

export function isSubscriptionExemptApi(pathname: string): boolean {
  if (SUBSCRIPTION_EXEMPT_API_EXACT.has(pathname)) return true;
  if (pathname.startsWith(FIRM_BILLING_API_PREFIX)) return true;
  return SUBSCRIPTION_EXEMPT_API_PREFIXES.some((p) => pathname.startsWith(p));
}

export function isSubscriptionExemptPage(pathname: string): boolean {
  if (SUBSCRIPTION_EXEMPT_PAGES.has(pathname)) return true;
  if (pathname.startsWith("/admin")) return true;
  if (pathname.startsWith("/superadmin")) return true;
  return false;
}

export function subscriptionExpiredJson(): Response {
  return new Response(JSON.stringify(SUBSCRIPTION_EXPIRED_BODY), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
