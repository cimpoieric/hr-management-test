import type { SupportedLng } from "./constants";

export { defaultLng, supportedLngs, type SupportedLng } from "./constants";

/** Switches i18next language in memory only (no persistence). */
export async function changeLanguage(lang: SupportedLng): Promise<void> {
  const { default: i18n } = await import("./index");
  await i18n.changeLanguage(lang);
}
