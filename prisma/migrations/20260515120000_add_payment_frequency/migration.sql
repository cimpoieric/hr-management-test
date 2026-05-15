-- Add payment frequency and period fields for weekly/monthly timesheets & payslips

ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "paymentFrequency" TEXT NOT NULL DEFAULT 'weekly';

ALTER TABLE "Timesheet" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'weekly';
ALTER TABLE "Timesheet" ADD COLUMN IF NOT EXISTS "periodKey" TEXT;
ALTER TABLE "Timesheet" ADD COLUMN IF NOT EXISTS "month" INTEGER;
ALTER TABLE "Timesheet" ADD COLUMN IF NOT EXISTS "monthYear" INTEGER;

UPDATE "Timesheet"
SET "periodKey" = CONCAT("year"::text, '-W', LPAD("weekNumber"::text, 2, '0'))
WHERE "periodKey" IS NULL;

ALTER TABLE "Timesheet" ALTER COLUMN "periodKey" SET NOT NULL;
ALTER TABLE "Timesheet" ALTER COLUMN "weekNumber" SET DEFAULT 0;

DROP INDEX IF EXISTS "Timesheet_employeeId_year_weekNumber_key";
CREATE UNIQUE INDEX "Timesheet_employeeId_periodKey_key" ON "Timesheet"("employeeId", "periodKey");
CREATE INDEX IF NOT EXISTS "Timesheet_type_idx" ON "Timesheet"("type");
CREATE INDEX IF NOT EXISTS "Timesheet_monthYear_month_idx" ON "Timesheet"("monthYear", "month");

ALTER TABLE "Payslip" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'weekly';
ALTER TABLE "Payslip" ADD COLUMN IF NOT EXISTS "month" INTEGER;
ALTER TABLE "Payslip" ADD COLUMN IF NOT EXISTS "monthYear" INTEGER;

ALTER TABLE "Payslip" ALTER COLUMN "weekNumber" SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Payslip_type_idx" ON "Payslip"("type");
CREATE INDEX IF NOT EXISTS "Payslip_monthYear_month_idx" ON "Payslip"("monthYear", "month");
