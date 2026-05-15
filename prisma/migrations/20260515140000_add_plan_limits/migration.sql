-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceLei" INTEGER NOT NULL,
    "maxEmployees" INTEGER NOT NULL,
    "features" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

INSERT INTO "Plan" ("id", "name", "priceLei", "maxEmployees", "features", "updatedAt") VALUES
(
  'clseedplan000000000001starter',
  'STARTER',
  49,
  10,
  ARRAY['basic_reports', 'export_excel', 'email_support'],
  CURRENT_TIMESTAMP
),
(
  'clseedplan000000000002business',
  'BUSINESS',
  149,
  50,
  ARRAY['basic_reports', 'export_excel', 'email_support', 'payroll_slips', 'export_pdf', 'auto_backup', 'priority_support'],
  CURRENT_TIMESTAMP
),
(
  'clseedplan000000000003enterprise',
  'ENTERPRISE',
  349,
  200,
  ARRAY['basic_reports', 'export_excel', 'email_support', 'payroll_slips', 'export_pdf', 'auto_backup', 'priority_support', 'api_access', 'custom_branding', 'advanced_reports', 'phone_support'],
  CURRENT_TIMESTAMP
),
(
  'clseedplan000000000004custom',
  'CUSTOM',
  999,
  999999,
  ARRAY['all'],
  CURRENT_TIMESTAMP
);

ALTER TABLE "Organization" ADD COLUMN "planId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "employeeCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Organization" ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Organization" ADD COLUMN "featuresOverride" TEXT;

UPDATE "Organization" AS o
SET "planId" = p."id"
FROM "Plan" AS p
WHERE p."name" = CASE lower(trim(o."plan"))
  WHEN 'starter' THEN 'STARTER'
  WHEN 'business' THEN 'BUSINESS'
  WHEN 'enterprise' THEN 'ENTERPRISE'
  WHEN 'custom' THEN 'CUSTOM'
  ELSE 'STARTER'
END;

UPDATE "Organization"
SET "planId" = (SELECT "id" FROM "Plan" WHERE "name" = 'STARTER' LIMIT 1)
WHERE "planId" IS NULL;

UPDATE "Organization"
SET "subscriptionStatus" = 'trial'
WHERE lower("status") = 'trial';

UPDATE "Organization" AS o
SET "employeeCount" = COALESCE(c.cnt, 0)
FROM (
  SELECT "organizationId", COUNT(*)::INTEGER AS cnt
  FROM "Employee"
  GROUP BY "organizationId"
) AS c
WHERE o."id" = c."organizationId";

ALTER TABLE "Organization" DROP COLUMN "plan";
ALTER TABLE "Organization" ALTER COLUMN "planId" SET NOT NULL;

ALTER TABLE "Organization" ADD CONSTRAINT "Organization_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Organization_planId_idx" ON "Organization"("planId");
CREATE INDEX "Organization_subscriptionStatus_idx" ON "Organization"("subscriptionStatus");

CREATE TABLE "UsageLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UsageLog_organizationId_idx" ON "UsageLog"("organizationId");
CREATE INDEX "UsageLog_createdAt_idx" ON "UsageLog"("createdAt");

ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
