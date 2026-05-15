import { cookies } from "next/headers";
import { defaultLng, supportedLngs, type SupportedLng } from "@/i18n/constants";

/** Locale cookie set by the client language selector. */
export async function getServerAppLanguage(): Promise<SupportedLng> {
  const store = await cookies();
  const raw = store.get("app-language")?.value;
  if (raw && (supportedLngs as readonly string[]).includes(raw)) {
    return raw as SupportedLng;
  }
  return defaultLng;
}
