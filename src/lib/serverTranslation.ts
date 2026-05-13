import type { SupportedLng } from "@/i18n/constants";
import { defaultLng } from "@/i18n/constants";
import en from "@/i18n/locales/en";
import ro from "@/i18n/locales/ro";

const bundles: Record<SupportedLng, typeof en> = {
  en,
  ro,
};

function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/**
 * Resolve a dot-path key from locale JSON (same shape as client `t("errors.codes.AUTH_001")`).
 */
export function serverT(lng: SupportedLng, key: string): string {
  const primary = getByPath(bundles[lng], key);
  if (typeof primary === "string") return primary;
  const fallback = getByPath(bundles[defaultLng], key);
  if (typeof fallback === "string") return fallback;
  return key;
}
