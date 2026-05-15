-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Timesheet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    "approvedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Timesheet_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Timesheet_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Timesheet" ("approvedAt", "approvedById", "createdAt", "dailyBreakdown", "employeeId", "endDate", "hoursWorked", "id", "notes", "standardHours", "startDate", "status", "submittedAt", "updatedAt", "weekNumber", "year") SELECT "approvedAt", "approvedById", "createdAt", "dailyBreakdown", "employeeId", "endDate", "hoursWorked", "id", "notes", "standardHours", "startDate", "status", "submittedAt", "updatedAt", "weekNumber", "year" FROM "Timesheet";
DROP TABLE "Timesheet";
ALTER TABLE "new_Timesheet" RENAME TO "Timesheet";
CREATE INDEX "Timesheet_employeeId_idx" ON "Timesheet"("employeeId");
CREATE INDEX "Timesheet_year_weekNumber_idx" ON "Timesheet"("year", "weekNumber");
CREATE INDEX "Timesheet_status_idx" ON "Timesheet"("status");
CREATE UNIQUE INDEX "Timesheet_employeeId_year_weekNumber_key" ON "Timesheet"("employeeId", "year", "weekNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
