-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "subscriptionCurrentPeriodEnd" DATETIME;
ALTER TABLE "Organization" ADD COLUMN "subscriptionGraceEndsAt" DATETIME;
