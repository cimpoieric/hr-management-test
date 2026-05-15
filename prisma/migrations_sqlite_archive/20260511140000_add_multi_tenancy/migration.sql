-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "status" TEXT NOT NULL DEFAULT 'active',
    "trialEndsAt" DATETIME,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "cui" TEXT,
    "registrationNumber" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "bankAccount" TEXT,
    "bankName" TEXT,
    "logoUrl" TEXT,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
INSERT INTO "Organization" ("id","name","slug","plan","status","defaultLanguage","createdAt","updatedAt") VALUES ('org_default_multitenancy_dev','Default Organization','default','starter','active','en',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER,
    "userId" TEXT,
    "userName" TEXT,
    "userRole" TEXT,
    "oldValues" TEXT,
    "newValues" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AuditLog" ("action", "createdAt", "entity", "entityId", "id", "ipAddress", "newValues", "oldValues", "userAgent", "userId", "userName", "userRole") SELECT "action", "createdAt", "entity", "entityId", "id", "ipAddress", "newValues", "oldValues", "userAgent", CASE WHEN "userId" IS NULL THEN NULL ELSE CAST("userId" AS TEXT) END, "userName", "userRole" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE TABLE "new_Company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxCode" TEXT,
    "address" TEXT,
    "countryId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'Activ',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Company_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Company_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Company" ("organizationId", "address", "countryId", "createdAt", "id", "name", "status", "taxCode", "updatedAt") SELECT 'org_default_multitenancy_dev', "address", "countryId", "createdAt", "id", "name", "status", "taxCode", "updatedAt" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
CREATE INDEX "Company_organizationId_idx" ON "Company"("organizationId");
CREATE UNIQUE INDEX "Company_organizationId_name_key" ON "Company"("organizationId", "name");
CREATE TABLE "new_Document" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "organizationId" TEXT NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "number" TEXT,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "issueDate" DATETIME,
    "expiryDate" DATETIME,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("organizationId", "createdAt", "deletedAt", "employeeId", "expiryDate", "fileName", "fileSize", "id", "issueDate", "mimeType", "number", "status", "storagePath", "type", "updatedAt", "uploadedAt") SELECT 'org_default_multitenancy_dev', "createdAt", "deletedAt", "employeeId", "expiryDate", "fileName", "fileSize", "id", "issueDate", "mimeType", "number", "status", "storagePath", "type", "updatedAt", "uploadedAt" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE INDEX "Document_organizationId_idx" ON "Document"("organizationId");
CREATE INDEX "Document_employeeId_idx" ON "Document"("employeeId");
CREATE INDEX "Document_type_idx" ON "Document"("type");
CREATE INDEX "Document_status_idx" ON "Document"("status");
CREATE INDEX "Document_expiryDate_idx" ON "Document"("expiryDate");
CREATE INDEX "Document_deletedAt_idx" ON "Document"("deletedAt");
CREATE TABLE "new_EmailLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "toAddress" TEXT NOT NULL,
    "toName" TEXT,
    "employeeId" INTEGER,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "templateKey" TEXT,
    "attachmentPath" TEXT,
    "attachmentName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "sentAt" DATETIME,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmailLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EmailLog" ("attachmentName", "attachmentPath", "body", "createdAt", "employeeId", "errorMessage", "id", "ipAddress", "retryCount", "sentAt", "status", "subject", "templateKey", "toAddress", "toName", "updatedAt", "userId") SELECT "attachmentName", "attachmentPath", "body", "createdAt", "employeeId", "errorMessage", "id", "ipAddress", "retryCount", "sentAt", "status", "subject", "templateKey", "toAddress", "toName", "updatedAt", CASE WHEN "userId" IS NULL THEN NULL ELSE CAST("userId" AS TEXT) END FROM "EmailLog";
DROP TABLE "EmailLog";
ALTER TABLE "new_EmailLog" RENAME TO "EmailLog";
CREATE INDEX "EmailLog_employeeId_idx" ON "EmailLog"("employeeId");
CREATE INDEX "EmailLog_userId_idx" ON "EmailLog"("userId");
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");
CREATE TABLE "new_Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "organizationId" TEXT NOT NULL,
    "cnp" TEXT NOT NULL,
    "cnpEncrypted" TEXT NOT NULL,
    "cnpHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "seriesCI" TEXT,
    "numberCI" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "iban" TEXT,
    "ibanHash" TEXT,
    "bankName" TEXT,
    "position" TEXT,
    "address" TEXT,
    "city" TEXT,
    "countryId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "observations" TEXT,
    "workNorm" TEXT,
    "salaryType" TEXT,
    "salaryAmount" DECIMAL,
    "salaryCurrency" TEXT NOT NULL DEFAULT 'RON',
    "salaryStartDate" DATETIME,
    "companyId" INTEGER NOT NULL,
    "hiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Employee_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("organizationId", "address", "bankName", "city", "cnp", "cnpEncrypted", "cnpHash", "companyId", "countryId", "createdAt", "email", "firstName", "hiredAt", "iban", "ibanHash", "id", "lastName", "numberCI", "observations", "phone", "position", "salaryAmount", "salaryCurrency", "salaryStartDate", "salaryType", "seriesCI", "status", "updatedAt", "workNorm") SELECT 'org_default_multitenancy_dev', "address", "bankName", "city", "cnp", "cnpEncrypted", "cnpHash", "companyId", "countryId", "createdAt", "email", "firstName", "hiredAt", "iban", "ibanHash", "id", "lastName", "numberCI", "observations", "phone", "position", "salaryAmount", "salaryCurrency", "salaryStartDate", "salaryType", "seriesCI", "status", "updatedAt", "workNorm" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");
CREATE INDEX "Employee_cnpHash_idx" ON "Employee"("cnpHash");
CREATE INDEX "Employee_organizationId_idx" ON "Employee"("organizationId");
CREATE INDEX "Employee_companyId_idx" ON "Employee"("companyId");
CREATE INDEX "Employee_countryId_idx" ON "Employee"("countryId");
CREATE INDEX "Employee_status_idx" ON "Employee"("status");
CREATE UNIQUE INDEX "Employee_organizationId_cnp_key" ON "Employee"("organizationId", "cnp");
CREATE TABLE "new_Payslip" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "organizationId" TEXT NOT NULL,
    "timesheetId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "grossTotal" DECIMAL NOT NULL,
    "deductionsTotal" DECIMAL NOT NULL,
    "netTotal" DECIMAL NOT NULL,
    "totalPaid" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "pdfPath" TEXT,
    "pdfGeneratedAt" DATETIME,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" DATETIME,
    "emailLogId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payslip_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payslip_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payslip_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payslip_emailLogId_fkey" FOREIGN KEY ("emailLogId") REFERENCES "EmailLog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Payslip" ("organizationId", "companyId", "createdAt", "currency", "deductionsTotal", "emailLogId", "emailSent", "emailSentAt", "employeeId", "grossTotal", "id", "netTotal", "pdfGeneratedAt", "pdfPath", "periodEnd", "periodStart", "timesheetId", "totalPaid", "updatedAt", "weekNumber", "year") SELECT 'org_default_multitenancy_dev', "companyId", "createdAt", "currency", "deductionsTotal", "emailLogId", "emailSent", "emailSentAt", "employeeId", "grossTotal", "id", "netTotal", "pdfGeneratedAt", "pdfPath", "periodEnd", "periodStart", "timesheetId", "totalPaid", "updatedAt", "weekNumber", "year" FROM "Payslip";
DROP TABLE "Payslip";
ALTER TABLE "new_Payslip" RENAME TO "Payslip";
CREATE UNIQUE INDEX "Payslip_timesheetId_key" ON "Payslip"("timesheetId");
CREATE INDEX "Payslip_organizationId_idx" ON "Payslip"("organizationId");
CREATE INDEX "Payslip_employeeId_idx" ON "Payslip"("employeeId");
CREATE INDEX "Payslip_companyId_idx" ON "Payslip"("companyId");
CREATE INDEX "Payslip_year_weekNumber_idx" ON "Payslip"("year", "weekNumber");
CREATE TABLE "new_Timesheet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "organizationId" TEXT NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "hoursWorked" DECIMAL NOT NULL,
    "standardHours" DECIMAL NOT NULL DEFAULT 40,
    "travelAllowance" REAL NOT NULL DEFAULT 0,
    "dailyBreakdown" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "approvedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Timesheet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Timesheet_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Timesheet_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Timesheet" ("organizationId", "approvedAt", "approvedById", "createdAt", "dailyBreakdown", "employeeId", "endDate", "hoursWorked", "id", "notes", "standardHours", "startDate", "status", "submittedAt", "travelAllowance", "updatedAt", "weekNumber", "year") SELECT 'org_default_multitenancy_dev', "approvedAt", CASE WHEN "approvedById" IS NULL THEN NULL ELSE CAST("approvedById" AS TEXT) END, "createdAt", "dailyBreakdown", "employeeId", "endDate", "hoursWorked", "id", "notes", "standardHours", "startDate", "status", "submittedAt", "travelAllowance", "updatedAt", "weekNumber", "year" FROM "Timesheet";
DROP TABLE "Timesheet";
ALTER TABLE "new_Timesheet" RENAME TO "Timesheet";
CREATE INDEX "Timesheet_organizationId_idx" ON "Timesheet"("organizationId");
CREATE INDEX "Timesheet_employeeId_idx" ON "Timesheet"("employeeId");
CREATE INDEX "Timesheet_year_weekNumber_idx" ON "Timesheet"("year", "weekNumber");
CREATE INDEX "Timesheet_status_idx" ON "Timesheet"("status");
CREATE UNIQUE INDEX "Timesheet_employeeId_year_weekNumber_key" ON "Timesheet"("employeeId", "year", "weekNumber");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "organizationId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "id", "isActive", "lastLoginAt", "mustChangePassword", "name", "organizationId", "password", "role", "updatedAt") SELECT "createdAt", "email", CAST("id" AS TEXT), "isActive", "lastLoginAt", "mustChangePassword", "name", 'org_default_multitenancy_dev', "password", CASE "role" WHEN 'administrator' THEN 'ORG_ADMIN' WHEN 'operator' THEN 'OPERATOR' WHEN 'doar_vizualizare' THEN 'EMPLOYEE' ELSE 'EMPLOYEE' END, "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
INSERT INTO "Settings" ("id","organizationId","updatedAt") VALUES ('settings_default_org_mt','org_default_multitenancy_dev',CURRENT_TIMESTAMP);

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_organizationId_key" ON "Settings"("organizationId");

