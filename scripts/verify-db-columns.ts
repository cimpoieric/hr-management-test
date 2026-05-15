import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [employees, timesheets] = await Promise.all([
    prisma.employee.findMany({
      take: 2,
      select: { id: true, paymentFrequency: true },
    }),
    prisma.timesheet.findMany({
      take: 2,
      select: { id: true, type: true, periodKey: true, weekNumber: true },
    }),
  ]);
  console.log("employees", employees);
  console.log("timesheets", timesheets);
}

main()
  .finally(() => prisma.$disconnect());
