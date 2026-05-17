-- AlterTable
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "gdprInformedAt" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "gdprInformedBy" TEXT;
