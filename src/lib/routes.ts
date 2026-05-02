/**
 * Rute UI canonice — folosite în Link-uri și redirect-uri.
 * Rutele vechi (/dashboard, /importuri-in-asteptare) rămân valide prin redirect.
 */
export const ROUTES = {
  dashboard: "/panou-de-control",
  employees: "/angajati",
  documents: "/documente",
  deployments: "/detasari",
  imports: "/importuri",
  importManual: "/import/manual",
  importEmail: "/import/email",
  reports: "/rapoarte",
  export: "/export",
  pay: "/plata",
  settings: "/setari",
  companies: "/setari/firme",
  countries: "/setari/tari",
  users: "/utilizatori",
  backup: "/backup",
} as const;

/** Rute înlocuite; păstrate doar pentru redirect. */
export const LEGACY_ROUTES = {
  dashboard: "/dashboard",
  importsList: "/importuri-in-asteptare",
} as const;
