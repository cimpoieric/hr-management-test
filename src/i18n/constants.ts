/** Pure constants (no react-i18next). Safe for API / server bundles. */

export const supportedLngs = ["en", "ro"] as const;
export type SupportedLng = (typeof supportedLngs)[number];

export const defaultLng: SupportedLng = "en";
