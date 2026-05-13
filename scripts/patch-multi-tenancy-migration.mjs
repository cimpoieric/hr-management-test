import fs from "node:fs";

const p = "prisma/migrations/20260511140000_add_multi_tenancy/migration.sql";
let s = fs.readFileSync(p, "utf8");

const ORG = "org_default_multitenancy_dev";

const orgInsert = `INSERT INTO "Organization" ("id","name","slug","plan","status","defaultLanguage","createdAt","updatedAt") VALUES ('${ORG}','Default Organization','default','starter','active','en',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

`;

s = s.replace('CREATE TABLE "Settings"', `${orgInsert}CREATE TABLE "Settings"`);

s = s.replace(
  `INSERT INTO "new_Company" ("address", "countryId", "createdAt", "id", "name", "status", "taxCode", "updatedAt") SELECT "address", "countryId", "createdAt", "id", "name", "status", "taxCode", "updatedAt" FROM "Company";`,
  `INSERT INTO "new_Company" ("organizationId", "address", "countryId", "createdAt", "id", "name", "status", "taxCode", "updatedAt") SELECT '${ORG}', "address", "countryId", "createdAt", "id", "name", "status", "taxCode", "updatedAt" FROM "Company";`,
);

s = s.replace(
  `INSERT INTO "new_Document" ("createdAt", "deletedAt", "employeeId", "expiryDate", "fileName", "fileSize", "id", "issueDate", "mimeType", "number", "status", "storagePath", "type", "updatedAt", "uploadedAt") SELECT "createdAt", "deletedAt", "employeeId", "expiryDate", "fileName", "fileSize", "id", "issueDate", "mimeType", "number", "status", "storagePath", "type", "updatedAt", "uploadedAt" FROM "Document";`,
  `INSERT INTO "new_Document" ("organizationId", "createdAt", "deletedAt", "employeeId", "expiryDate", "fileName", "fileSize", "id", "issueDate", "mimeType", "number", "status", "storagePath", "type", "updatedAt", "uploadedAt") SELECT '${ORG}', "createdAt", "deletedAt", "employeeId", "expiryDate", "fileName", "fileSize", "id", "issueDate", "mimeType", "number", "status", "storagePath", "type", "updatedAt", "uploadedAt" FROM "Document";`,
);

s = s.replace(
  `INSERT INTO "new_Employee" ("address", "bankName", "city", "cnp", "cnpEncrypted", "cnpHash", "companyId", "countryId", "createdAt", "email", "firstName", "hiredAt", "iban", "ibanHash", "id", "lastName", "numberCI", "observations", "phone", "position", "salaryAmount", "salaryCurrency", "salaryStartDate", "salaryType", "seriesCI", "status", "updatedAt", "workNorm") SELECT "address", "bankName", "city", "cnp", "cnpEncrypted", "cnpHash", "companyId", "countryId", "createdAt", "email", "firstName", "hiredAt", "iban", "ibanHash", "id", "lastName", "numberCI", "observations", "phone", "position", "salaryAmount", "salaryCurrency", "salaryStartDate", "salaryType", "seriesCI", "status", "updatedAt", "workNorm" FROM "Employee";`,
  `INSERT INTO "new_Employee" ("organizationId", "address", "bankName", "city", "cnp", "cnpEncrypted", "cnpHash", "companyId", "countryId", "createdAt", "email", "firstName", "hiredAt", "iban", "ibanHash", "id", "lastName", "numberCI", "observations", "phone", "position", "salaryAmount", "salaryCurrency", "salaryStartDate", "salaryType", "seriesCI", "status", "updatedAt", "workNorm") SELECT '${ORG}', "address", "bankName", "city", "cnp", "cnpEncrypted", "cnpHash", "companyId", "countryId", "createdAt", "email", "firstName", "hiredAt", "iban", "ibanHash", "id", "lastName", "numberCI", "observations", "phone", "position", "salaryAmount", "salaryCurrency", "salaryStartDate", "salaryType", "seriesCI", "status", "updatedAt", "workNorm" FROM "Employee";`,
);

s = s.replace(
  `INSERT INTO "new_Payslip" ("companyId", "createdAt", "currency", "deductionsTotal", "emailLogId", "emailSent", "emailSentAt", "employeeId", "grossTotal", "id", "netTotal", "pdfGeneratedAt", "pdfPath", "periodEnd", "periodStart", "timesheetId", "totalPaid", "updatedAt", "weekNumber", "year") SELECT "companyId", "createdAt", "currency", "deductionsTotal", "emailLogId", "emailSent", "emailSentAt", "employeeId", "grossTotal", "id", "netTotal", "pdfGeneratedAt", "pdfPath", "periodEnd", "periodStart", "timesheetId", "totalPaid", "updatedAt", "weekNumber", "year" FROM "Payslip";`,
  `INSERT INTO "new_Payslip" ("organizationId", "companyId", "createdAt", "currency", "deductionsTotal", "emailLogId", "emailSent", "emailSentAt", "employeeId", "grossTotal", "id", "netTotal", "pdfGeneratedAt", "pdfPath", "periodEnd", "periodStart", "timesheetId", "totalPaid", "updatedAt", "weekNumber", "year") SELECT '${ORG}', "companyId", "createdAt", "currency", "deductionsTotal", "emailLogId", "emailSent", "emailSentAt", "employeeId", "grossTotal", "id", "netTotal", "pdfGeneratedAt", "pdfPath", "periodEnd", "periodStart", "timesheetId", "totalPaid", "updatedAt", "weekNumber", "year" FROM "Payslip";`,
);

s = s.replace(
  `INSERT INTO "new_Timesheet" ("approvedAt", "approvedById", "createdAt", "dailyBreakdown", "employeeId", "endDate", "hoursWorked", "id", "notes", "standardHours", "startDate", "status", "submittedAt", "travelAllowance", "updatedAt", "weekNumber", "year") SELECT "approvedAt", "approvedById", "createdAt", "dailyBreakdown", "employeeId", "endDate", "hoursWorked", "id", "notes", "standardHours", "startDate", "status", "submittedAt", "travelAllowance", "updatedAt", "weekNumber", "year" FROM "Timesheet";`,
  `INSERT INTO "new_Timesheet" ("organizationId", "approvedAt", "approvedById", "createdAt", "dailyBreakdown", "employeeId", "endDate", "hoursWorked", "id", "notes", "standardHours", "startDate", "status", "submittedAt", "travelAllowance", "updatedAt", "weekNumber", "year") SELECT '${ORG}', "approvedAt", CASE WHEN "approvedById" IS NULL THEN NULL ELSE CAST("approvedById" AS TEXT) END, "createdAt", "dailyBreakdown", "employeeId", "endDate", "hoursWorked", "id", "notes", "standardHours", "startDate", "status", "submittedAt", "travelAllowance", "updatedAt", "weekNumber", "year" FROM "Timesheet";`,
);

s = s.replace(
  `INSERT INTO "new_AuditLog" ("action", "createdAt", "entity", "entityId", "id", "ipAddress", "newValues", "oldValues", "userAgent", "userId", "userName", "userRole") SELECT "action", "createdAt", "entity", "entityId", "id", "ipAddress", "newValues", "oldValues", "userAgent", "userId", "userName", "userRole" FROM "AuditLog";`,
  `INSERT INTO "new_AuditLog" ("action", "createdAt", "entity", "entityId", "id", "ipAddress", "newValues", "oldValues", "userAgent", "userId", "userName", "userRole") SELECT "action", "createdAt", "entity", "entityId", "id", "ipAddress", "newValues", "oldValues", "userAgent", CASE WHEN "userId" IS NULL THEN NULL ELSE CAST("userId" AS TEXT) END, "userName", "userRole" FROM "AuditLog";`,
);

s = s.replace(
  `INSERT INTO "new_EmailLog" ("attachmentName", "attachmentPath", "body", "createdAt", "employeeId", "errorMessage", "id", "ipAddress", "retryCount", "sentAt", "status", "subject", "templateKey", "toAddress", "toName", "updatedAt", "userId") SELECT "attachmentName", "attachmentPath", "body", "createdAt", "employeeId", "errorMessage", "id", "ipAddress", "retryCount", "sentAt", "status", "subject", "templateKey", "toAddress", "toName", "updatedAt", "userId" FROM "EmailLog";`,
  `INSERT INTO "new_EmailLog" ("attachmentName", "attachmentPath", "body", "createdAt", "employeeId", "errorMessage", "id", "ipAddress", "retryCount", "sentAt", "status", "subject", "templateKey", "toAddress", "toName", "updatedAt", "userId") SELECT "attachmentName", "attachmentPath", "body", "createdAt", "employeeId", "errorMessage", "id", "ipAddress", "retryCount", "sentAt", "status", "subject", "templateKey", "toAddress", "toName", "updatedAt", CASE WHEN "userId" IS NULL THEN NULL ELSE CAST("userId" AS TEXT) END FROM "EmailLog";`,
);

s = s.replace(
  `INSERT INTO "new_User" ("createdAt", "email", "id", "isActive", "lastLoginAt", "mustChangePassword", "name", "password", "role", "updatedAt") SELECT "createdAt", "email", "id", "isActive", "lastLoginAt", "mustChangePassword", "name", "password", "role", "updatedAt" FROM "User";`,
  `INSERT INTO "new_User" ("createdAt", "email", "id", "isActive", "lastLoginAt", "mustChangePassword", "name", "organizationId", "password", "role", "updatedAt") SELECT "createdAt", "email", CAST("id" AS TEXT), "isActive", "lastLoginAt", "mustChangePassword", "name", '${ORG}', "password", CASE "role" WHEN 'administrator' THEN 'ORG_ADMIN' WHEN 'operator' THEN 'OPERATOR' WHEN 'doar_vizualizare' THEN 'EMPLOYEE' ELSE 'EMPLOYEE' END, "updatedAt" FROM "User";`,
);

s = s.replace(
  "PRAGMA foreign_keys=ON;",
  `INSERT INTO "Settings" ("id","organizationId","updatedAt") VALUES ('settings_default_org_mt','${ORG}',CURRENT_TIMESTAMP);

PRAGMA foreign_keys=ON;`,
);

fs.writeFileSync(p, s);
console.log("patched", p);
