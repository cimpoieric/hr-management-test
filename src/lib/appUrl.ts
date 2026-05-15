import "server-only";

/**
 * URL public al aplicatiei (Stripe, email reset, fetch intern).
 * Ordine: NEXT_PUBLIC_APP_URL, NEXTAUTH_URL, VERCEL_URL.
 */
export function resolveAppBaseUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//i, "");
    return `https://${host}`;
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  throw new Error(
    "Set NEXT_PUBLIC_APP_URL or NEXTAUTH_URL for production deployments.",
  );
}
