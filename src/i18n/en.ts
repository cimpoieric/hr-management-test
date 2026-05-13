/**
 * Placeholder EN (FAZA 3) � structur? minim? ca s? poat? fi extins? f?r? s? rup? importuri.
 * Momentan nu este folosit �n UI.
 */
export const en = {
  nav: {
    dashboard: "Dashboard",
    employees: "Employees",
    documents: "Documents",
    deployments: "Deployments",
    imports: "Imports",
    reports: "Reports",
    export: "Export",
    pay: "Pay",
    settings: "Settings",
    companies: "Companies",
    countries: "Countries",
    users: "Users",
    backup: "Backup",
  },
} as const;

export type EnMessages = typeof en;
