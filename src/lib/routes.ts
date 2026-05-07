/**
 * Rute UI canonice — folosite în Link-uri și redirect-uri.
 * Rutele vechi (/dashboard, /importuri-in-asteptare) rămân valide prin redirect.
 */
export const ROUTES = {
  dashboard: "/",
  employees: "/angajati",
  documents: "/documente",
  deployments: "/detasari",
  imports: "/importuri",
  importManual: "/import/manual",
  importEmail: "/import/email",
  reports: "/rapoarte",
  export: "/export",
  pay: "/plata",
  timesheets: "/pontaj",
  payslips: "/fluturasi",
  settings: "/setari",
  companies: "/firme",
  countries: "/tari",
  users: "/utilizatori",
  backup: "/backup",
} as const;

/** Rute înlocuite; păstrate doar pentru redirect. */
export const LEGACY_ROUTES = {
  dashboard: "/panou-de-control",
  importsList: "/importuri-in-asteptare",
} as const;
