import { resolveAppBaseUrl } from "@/lib/appUrl";
import { headers } from "next/headers";

/** Bază URL pentru `fetch` din Server Components către rutele proprii (Node cere URL absolut). */
export async function getInternalRequestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) {
    return resolveAppBaseUrl();
  }
  const proto =
    h.get("x-forwarded-proto") ?? (process.env.VERCEL ? "https" : "http");
  return `${proto}://${host}`;
}
