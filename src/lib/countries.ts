/**
 * Lista țări UE pentru detașări — ISO 3166-1 alpha-2 + nume românesc + emoji steag.
 *
 * Pentru a adăuga o țară nouă: adaugă un obiect în array.
 */

export interface Country {
  code: string;      // ISO 3166-1 alpha-2 (ex: "NL")
  name: string;      // Nume românesc (ex: "Olanda")
  flag: string;      // Emoji steag (ex: "🇳🇱")
  currency: string;  // Ex: "EUR"
}

export const DEPLOYMENT_COUNTRIES: Country[] = [
  { code: "NL", name: "Olanda",       flag: "🇳🇱", currency: "EUR" },
  { code: "DE", name: "Germania",     flag: "🇩🇪", currency: "EUR" },
  { code: "IT", name: "Italia",       flag: "🇮🇹", currency: "EUR" },
  { code: "BE", name: "Belgia",       flag: "🇧🇪", currency: "EUR" },
  { code: "FR", name: "Franța",       flag: "🇫🇷", currency: "EUR" },
  { code: "AT", name: "Austria",      flag: "🇦🇹", currency: "EUR" },
  { code: "ES", name: "Spania",       flag: "🇪🇸", currency: "EUR" },
  { code: "DK", name: "Danemarca",    flag: "🇩🇰", currency: "DKK" },
  { code: "SE", name: "Suedia",       flag: "🇸🇪", currency: "SEK" },
  { code: "UK", name: "Marea Britanie", flag: "🇬🇧", currency: "GBP" },
];

/** Coduri valide pentru validare rapidă */
export const VALID_COUNTRY_CODES = DEPLOYMENT_COUNTRIES.map((c) => c.code);

/** Verifică dacă un cod de țară este valid. */
export function isValidCountryCode(code: string): boolean {
  return VALID_COUNTRY_CODES.includes(code.toUpperCase());
}

/** Returnează țara după cod. */
export function getCountryByCode(code: string): Country | undefined {
  return DEPLOYMENT_COUNTRIES.find((c) => c.code === code.toUpperCase());
}

/** Label pentru dropdown: 🇳🇱 Olanda (NL) */
export function getCountryLabel(code: string): string {
  const country = getCountryByCode(code);
  if (!country) return code;
  return `${country.flag} ${country.name} (${country.code})`;
}

/** Doar numele țării (pentru afișare). */
export function getCountryName(code: string): string {
  return getCountryByCode(code)?.name ?? code;
}

/** Statusuri valide pentru o detașare */
export const DEPLOYMENT_STATUSES = [
  "PLANNED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
] as const;

export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number];

export function isValidDeploymentStatus(s: string): s is DeploymentStatus {
  return DEPLOYMENT_STATUSES.includes(s as DeploymentStatus);
}
