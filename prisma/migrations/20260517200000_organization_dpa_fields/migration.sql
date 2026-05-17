-- AlterTable
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "dpaAcceptedAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "dpaAcceptedBy" TEXT;
