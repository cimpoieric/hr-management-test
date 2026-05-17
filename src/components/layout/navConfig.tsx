import { FEATURES, type PlanFeature } from "@/lib/plan-features";
import type { UserRole } from "@/lib/roles";
import {
  ROLES_EMPLOYEES_RW,
  ROLES_PAYROLL,
  ROLES_SETTINGS_ADMIN,
  UserRole as UR,
} from "@/lib/roles";
import { LEGACY_ROUTES, ROUTES } from "@/lib/routes";
import {
  BarChart3,
  Clock,
  Database,
  Download,
  Factory,
  FileSpreadsheet,
  FileText,
  Globe2,
  LayoutDashboard,
  MapPin,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ElementType } from "react";

export function isNavActive(pathname: string, href: string): boolean {
  if (href === ROUTES.dashboard) {
    return (
      pathname === ROUTES.dashboard ||
      pathname === LEGACY_ROUTES.dashboard ||
      pathname === "/"
    );
  }
  if (href === ROUTES.imports) {
    return (
      pathname === ROUTES.imports ||
      pathname.startsWith(`${ROUTES.imports}/`) ||
      pathname === LEGACY_ROUTES.imports ||
      pathname.startsWith(`${LEGACY_ROUTES.imports}/`) ||
      pathname === LEGACY_ROUTES.importsPending ||
      pathname.startsWith(`${LEGACY_ROUTES.importsPending}/`) ||
      pathname === LEGACY_ROUTES.importManual ||
      pathname.startsWith(`${LEGACY_ROUTES.importManual}/`) ||
      pathname === LEGACY_ROUTES.importEmail ||
      pathname.startsWith(`${LEGACY_ROUTES.importEmail}/`)
    );
  }
  if (href === ROUTES.settings) {
    return (
      pathname === ROUTES.settings ||
      pathname === ROUTES.adminSettings ||
      pathname.startsWith(`${ROUTES.settings}/`) ||
      pathname === LEGACY_ROUTES.settings ||
      pathname.startsWith(`${LEGACY_ROUTES.settings}/`)
    );
  }
  if (href === ROUTES.companies) {
    return (
      pathname === ROUTES.companies ||
      pathname === ROUTES.adminCompanies ||
      pathname === LEGACY_ROUTES.settingsCompanies ||
      pathname === LEGACY_ROUTES.firme
    );
  }
  if (href === ROUTES.countries) {
    return (
      pathname === ROUTES.countries ||
      pathname === ROUTES.adminCountries ||
      pathname === LEGACY_ROUTES.settingsCountries ||
      pathname === LEGACY_ROUTES.tari
    );
  }
  if (href === ROUTES.timesheets) {
    return (
      pathname === ROUTES.timesheets ||
      pathname.startsWith(`${ROUTES.timesheets}/`) ||
      pathname === LEGACY_ROUTES.timesheets ||
      pathname.startsWith(`${LEGACY_ROUTES.timesheets}/`)
    );
  }
  if (href === ROUTES.payslips) {
    return (
      pathname === ROUTES.payslips ||
      pathname.startsWith(`${ROUTES.payslips}/`) ||
      pathname === LEGACY_ROUTES.payslips ||
      pathname.startsWith(`${LEGACY_ROUTES.payslips}/`)
    );
  }
  if (href === ROUTES.employees) {
    return (
      pathname === ROUTES.employees ||
      pathname.startsWith(`${ROUTES.employees}/`) ||
      pathname === LEGACY_ROUTES.employees ||
      pathname.startsWith(`${LEGACY_ROUTES.employees}/`)
    );
  }
  if (href === ROUTES.documents) {
    return (
      pathname === ROUTES.documents ||
      pathname.startsWith(`${ROUTES.documents}/`) ||
      pathname === LEGACY_ROUTES.documents ||
      pathname.startsWith(`${LEGACY_ROUTES.documents}/`)
    );
  }
  if (href === ROUTES.deployments) {
    return (
      pathname === ROUTES.deployments ||
      pathname.startsWith(`${ROUTES.deployments}/`) ||
      pathname === LEGACY_ROUTES.deployments ||
      pathname.startsWith(`${LEGACY_ROUTES.deployments}/`)
    );
  }
  if (href === ROUTES.reports) {
    return (
      pathname === ROUTES.reports ||
      pathname.startsWith(`${ROUTES.reports}/`) ||
      pathname === LEGACY_ROUTES.reports ||
      pathname.startsWith(`${LEGACY_ROUTES.reports}/`)
    );
  }
  if (href === ROUTES.pay) {
    return (
      pathname === ROUTES.pay ||
      pathname.startsWith(`${ROUTES.pay}/`) ||
      pathname === LEGACY_ROUTES.pay ||
      pathname.startsWith(`${LEGACY_ROUTES.pay}/`)
    );
  }
  if (href === ROUTES.admin) {
    return (
      pathname === ROUTES.admin ||
      pathname.startsWith(`${ROUTES.admin}/`) ||
      pathname === ROUTES.adminCompanies
    );
  }
  if (href === ROUTES.users) {
    return (
      pathname === ROUTES.users ||
      pathname === ROUTES.adminUsers ||
      pathname.startsWith(`${ROUTES.users}/`) ||
      pathname.startsWith(`${ROUTES.adminUsers}/`) ||
      pathname === LEGACY_ROUTES.users ||
      pathname.startsWith(`${LEGACY_ROUTES.users}/`)
    );
  }
  if (href === ROUTES.backup) {
    return pathname === ROUTES.backup || pathname === ROUTES.adminBackup;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PlataNavIcon({ size = 18 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center shrink-0 leading-none"
      style={{ fontSize: size }}
      aria-hidden
    >
      {"\u20AC"}
    </span>
  );
}

export type SidebarRouteDef = {
  href: string;
  i18nKey: string;
  icon: LucideIcon | ElementType<{ size?: number }>;
  /** Daca lipseste: orice rol autentificat (JWT valid). */
  rolesAllowed?: UserRole[];
  showAdminBadge?: boolean;
  /** Feature plan necesar (UI lock; backend valideaza separat). */
  planFeature?: PlanFeature | string;
};

export const SIDEBAR_ROUTE_DEFS: SidebarRouteDef[] = [
  { href: ROUTES.dashboard, i18nKey: "nav.dashboard", icon: LayoutDashboard },
  {
    href: ROUTES.employees,
    i18nKey: "nav.employees",
    icon: Users,
    rolesAllowed: ROLES_EMPLOYEES_RW,
  },
  { href: ROUTES.documents, i18nKey: "nav.documents", icon: FileText },
  {
    href: ROUTES.deployments,
    i18nKey: "nav.deployments",
    icon: MapPin,
    rolesAllowed: ROLES_EMPLOYEES_RW,
  },
  {
    href: ROUTES.imports,
    i18nKey: "nav.imports",
    icon: Download,
    rolesAllowed: ROLES_EMPLOYEES_RW,
  },
  {
    href: ROUTES.reports,
    i18nKey: "nav.reports",
    icon: BarChart3,
    rolesAllowed: ROLES_SETTINGS_ADMIN,
    planFeature: FEATURES.EXPORT_PDF,
  },
  {
    href: ROUTES.export,
    i18nKey: "nav.export",
    icon: FileSpreadsheet,
    rolesAllowed: ROLES_SETTINGS_ADMIN,
    planFeature: FEATURES.EXPORT_PDF,
  },
  {
    href: ROUTES.pay,
    i18nKey: "nav.pay",
    icon: PlataNavIcon,
    rolesAllowed: ROLES_SETTINGS_ADMIN,
  },
  { href: ROUTES.timesheets, i18nKey: "nav.timesheets", icon: Clock },
  {
    href: ROUTES.payslips,
    i18nKey: "nav.payslips",
    icon: FileText,
    rolesAllowed: ROLES_PAYROLL,
    planFeature: FEATURES.PAYROLL_SLIPS,
  },
  {
    href: ROUTES.settings,
    i18nKey: "nav.settings",
    icon: Settings,
    rolesAllowed: ROLES_SETTINGS_ADMIN,
    showAdminBadge: true,
  },
  {
    href: ROUTES.companies,
    i18nKey: "nav.companies",
    icon: Factory,
    rolesAllowed: ROLES_SETTINGS_ADMIN,
    showAdminBadge: true,
  },
  {
    href: ROUTES.countries,
    i18nKey: "nav.countries",
    icon: Globe2,
    rolesAllowed: ROLES_SETTINGS_ADMIN,
    showAdminBadge: true,
  },
  {
    href: ROUTES.users,
    i18nKey: "nav.users",
    icon: Shield,
    rolesAllowed: ROLES_SETTINGS_ADMIN,
    showAdminBadge: true,
  },
  {
    href: ROUTES.backup,
    i18nKey: "nav.backup",
    icon: Database,
    rolesAllowed: ROLES_SETTINGS_ADMIN,
    showAdminBadge: true,
    planFeature: FEATURES.AUTO_BACKUP,
  },
];

export const ORG_ADMIN_SIDEBAR_HREFS_WITH_ADMIN_BADGE = new Set<string>([
  ROUTES.settings,
  ROUTES.companies,
  ROUTES.countries,
  ROUTES.users,
  ROUTES.backup,
]);

export const SUPER_ADMIN_SIDEBAR_ROUTE_DEFS: SidebarRouteDef[] = [
  {
    href: ROUTES.admin,
    i18nKey: "nav.superAdmin",
    icon: Shield,
    showAdminBadge: true,
  },
  {
    href: ROUTES.adminCompanies,
    i18nKey: "nav.companies",
    icon: Factory,
    showAdminBadge: true,
  },
  {
    href: ROUTES.adminOrganizationsCreate,
    i18nKey: "nav.addOrganization",
    icon: Factory,
    showAdminBadge: true,
  },
  {
    href: ROUTES.adminUsers,
    i18nKey: "nav.users",
    icon: Shield,
    showAdminBadge: true,
  },
  {
    href: ROUTES.adminCountries,
    i18nKey: "nav.countries",
    icon: Globe2,
    showAdminBadge: true,
  },
  {
    href: ROUTES.adminBackup,
    i18nKey: "nav.backup",
    icon: Database,
    showAdminBadge: true,
  },
  {
    href: ROUTES.adminSettings,
    i18nKey: "nav.settings",
    icon: Settings,
    showAdminBadge: true,
  },
];
