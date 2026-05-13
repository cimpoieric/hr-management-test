import type { NextRequest } from "next/server";
import { defaultLng, supportedLngs, type SupportedLng } from "@/i18n/constants";

/**
 * Locale for API error messages: cookie (if set by client) or Accept-Language, else default.
 */
export function resolveRequestLocale(request: NextRequest): SupportedLng {
  const fromCookie = request.cookies.get("app-language")?.value;
  if (fromCookie && (supportedLngs as readonly string[]).includes(fromCookie)) {
    return fromCookie as SupportedLng;
  }

  const accept = request.headers.get("accept-language") ?? "";
  if (/^\s*ro\b/i.test(accept) || /[,;]\s*ro\b/i.test(accept)) {
    return "ro";
  }

  return defaultLng;
}
