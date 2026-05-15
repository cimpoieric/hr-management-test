/**
 * Shared domain and UI/API types.
 * Numeric PKs match Prisma; API JSON may use ISO date strings.
 */

// --- Organization -------------------------------------------------------------

export type OrganizationPlan = "starter" | "business" | "enterprise" | "custom";

export type OrganizationStatus = "active" | "suspended" | "trial" | "grace";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  planId: string;
  plan?: OrganizationPlan;
  employeeCount: number;
  subscriptionStatus: "active" | "trial" | "expired";
  featuresOverride?: string | null;
  status: OrganizationStatus;
  trialEndsAt?: Date | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionCurrentPeriodEnd?: Date | null;
  subscriptionGraceEndsAt?: Date | null;
  cui?: string | null;
  registrationNumber?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  bankAccount?: string | null;
  bankName?: string | null;
  logoUrl?: string | null;
  defaultLanguage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// --- User --------------------------------------------------------------------

export type UserRoleCode =
  | "SUPER_ADMIN"
  | "ORG_ADMIN"
  | "OPERATOR"
  | "EMPLOYEE";

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role: UserRoleCode;
  organizationId: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** `user` object from GET /api/auth/me (no password). */
export interface AuthMeApiUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  organizationId: string;
  mustChangePassword: boolean;
}

export type AuthMeResponse = {
  user?: AuthMeApiUser;
  error?: string;
};

// --- Employee (presentation model) -------------------------------------------

export type EmployeeStatusUi = "active" | "inactive" | "onLeave";

/**
 * Canonical employee view (product shape).
 * `id` is numeric in this codebase (Prisma); use string only if you migrate IDs.
 */
export interface Employee {
  id: number;
  organizationId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  position: string;
  department: string;
  hireDate: Date;
  salary: number;
  status: EmployeeStatusUi;
  cnp?: string;
  address?: string | null;
  emergencyContact?: string;
  bankAccount?: string | null;
  bankName?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Row from GET /api/employees and employee tables. */
export interface EmployeeListApiRow {
  id: number;
  firstName: string;
  lastName: string;
  cnp: string;
  seriesCI?: string | null;
  numberCI?: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  status: string;
  address?: string | null;
  city: string | null;
  countryId: number | null;
  country: CountryOption | null;
  company: CompanyOption | null;
  documentCount: number;
  deploymentCount: number;
  createdAt: string;
  hiredAt: string | null;
  bankName?: string | null;
  iban?: string | null;
  observations?: string | null;
  workNorm?: string | null;
  /** Profil marcat detasare (import/CIM) — poate exista fara rand Deployment. */
  isMarkedDetached?: boolean;
  hasActiveDeployment?: boolean;
  salaryType?: "LUNAR" | "SAPTAMANAL" | "ORA" | string | null;
  salaryAmount?: number | null;
  salaryCurrency?: string | null;
  salaryStartDate?: string | null;
}

/** Minimal employee row for weekly pay page. */
export interface EmployeeWeeklyPayRow {
  id: number;
  firstName: string;
  lastName: string;
  cnp: string;
  salaryType?: string | null;
  salaryAmount?: number | null;
  salaryCurrency?: string | null;
}

export type CompanyOption = { id: number; name: string };

export type CountryOption = { id: number; name: string; code: string };

export type EmployeeOption = {
  id: number;
  firstName: string;
  lastName: string;
  position?: string | null;
  paymentFrequency?: string | null;
  salaryType?: string | null;
};

// --- Document ----------------------------------------------------------------

export type DocumentType =
  | "CONTRACT"
  | "ID"
  | "MEDICAL"
  | "A1"
  | "AUTHORIZATION"
  | "VISA"
  | "OTHER";

export type DocumentRowStatus =
  | "VALID"
  | "EXPIRING_SOON"
  | "EXPIRED"
  | "PENDING";

export interface Document {
  id: number;
  organizationId: string;
  employeeId: number;
  type: DocumentType;
  number: string | null;
  fileName: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  status: DocumentRowStatus;
  issueDate: Date | null;
  expiryDate: Date | null;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

// --- Payroll (Payslip) --------------------------------------------------------

export interface PayslipItem {
  id: number;
  payslipId: number;
  type: string;
  label: string;
  description?: string | null;
  amount: number;
  quantity?: number | null;
  rate?: number | null;
  sortOrder: number;
}

export interface Payslip {
  id: number;
  organizationId: string;
  timesheetId: number;
  employeeId: number;
  companyId: number;
  type?: string;
  weekNumber: number;
  year: number;
  month?: number | null;
  monthYear?: number | null;
  periodStart: Date;
  periodEnd: Date;
  grossTotal: number;
  deductionsTotal: number;
  netTotal: number;
  totalPaid: number;
  currency: string;
  pdfPath?: string | null;
  pdfGeneratedAt?: Date | null;
  emailSent: boolean;
  emailSentAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PayslipListItem = {
  id: number;
  employeeId: number;
  weekNumber: number;
  year: number;
  periodStart: string;
  periodEnd: string;
  currency: string;
  totalPaid: string;
  netTotal: string;
  emailSent: boolean;
  emailSentAt?: string | null;
  pdfPath?: string | null;
  pdfGeneratedAt?: string | null;
  employee: { firstName: string; lastName: string; email?: string | null };
  timesheet: { hoursWorked: string; status: string };
  items?: Array<{ type: string; amount: string; sortOrder: number }>;
};

// --- Attendance (Timesheet) ---------------------------------------------------

export interface Timesheet {
  id: number;
  organizationId: string;
  employeeId: number;
  weekNumber: number;
  year: number;
  startDate: Date;
  endDate: Date;
  hoursWorked: number;
  standardHours: number;
  travelAllowance: number;
  dailyBreakdown?: string | null;
  status: string;
  notes?: string | null;
  submittedAt?: Date | null;
  approvedAt?: Date | null;
  approvedById?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type TimesheetRow = {
  id: number;
  employeeId: number;
  type?: string;
  periodKey?: string;
  weekNumber: number;
  year: number;
  month?: number | null;
  monthYear?: number | null;
  startDate: string;
  endDate: string;
  hoursWorked: string;
  standardHours: string;
  travelAllowance: string | number;
  status: string;
  employee: {
    id: number;
    firstName: string;
    lastName: string;
    position: string | null;
    salaryType?: string | null;
    salaryAmount?: string | null;
    salaryCurrency?: string | null;
  };
  payslip?: { id: number } | null;
};

/** Subset used by timesheet edit UI. */
export type EditTimesheet = {
  id: number;
  employeeId: number;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  hoursWorked: string;
  standardHours: string;
  travelAllowance?: number;
  dailyBreakdown?: string | null;
  notes?: string | null;
  status: string;
};

/** GET /api/attendance/[id] payload (may include nested employee). */
export type TimesheetEditApiPayload = EditTimesheet & {
  employee?: EmployeeOption;
};

// --- Settings -----------------------------------------------------------------

export type AttendanceWeekdayCode =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

export interface AttendanceSettingsPayload {
  workStart: string;
  workEnd: string;
  workdays: AttendanceWeekdayCode[];
  lateToleranceMinutes: number;
}

export interface Settings {
  id: string;
  organizationId: string;
  attendanceSettingsJson?: string | null;
  updatedAt: Date;
}

// --- Pagination / API helpers -------------------------------------------------

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiErrorJson = { error?: string };
export type ApiResultJson = ApiErrorJson & { warning?: string };

// --- Dashboard ----------------------------------------------------------------

export type DashboardStats = {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  activeDeployments: number;
  expiredDocuments: number;
  expiringSoonDocuments: number;
  pendingImports: number;
  monthlySalaryCost: number;
  monthlySalaryEmployeeCount: number;
  monthlySalaryCurrency: string;
  /** Most common employee currency (secondary display); totals may be in RON. */
  monthlySalaryPredominantCurrency: string;
  documentAlertDays: number;
};

export type DeploymentCountry = {
  country: string;
  code: string;
  count: number;
};

export type ActivityItem = {
  id: number;
  action: string;
  entity: string;
  entityId: number | null;
  userName: string | null;
  createdAt: string;
};

// --- Export columns -------------------------------------------------------------

export type ExportColumnCategory =
  | "personal"
  | "professional"
  | "financial"
  | "meta";

export interface ExportColumnOption {
  key: string;
  label: string;
  category: ExportColumnCategory;
}
