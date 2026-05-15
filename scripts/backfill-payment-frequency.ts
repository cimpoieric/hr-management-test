import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const emp = await prisma.$executeRaw`
    UPDATE "Employee" SET "paymentFrequency" = 'weekly'
    WHERE "paymentFrequency" IS NULL OR TRIM("paymentFrequency") = ''
  `;

  const tsType = await prisma.$executeRaw`
    UPDATE "Timesheet" SET "type" = 'weekly'
    WHERE "type" IS NULL OR TRIM("type") = ''
  `;

  const missingPeriodKey = await prisma.$executeRaw`
    UPDATE "Timesheet"
    SET "periodKey" = CONCAT("year"::text, '-W', LPAD(GREATEST("weekNumber", 1)::text, 2, '0'))
    WHERE "periodKey" IS NULL OR TRIM("periodKey") = ''
  `;

  const psType = await prisma.$executeRaw`
    UPDATE "Payslip" SET "type" = 'weekly'
    WHERE "type" IS NULL OR TRIM("type") = ''
  `;

  console.log({
    employeesUpdated: emp,
    timesheetsTypeUpdated: tsType,
    timesheetsPeriodKeyBackfill: missingPeriodKey,
    payslipsTypeUpdated: psType,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
