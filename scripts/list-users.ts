import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      organizationId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  console.log(JSON.stringify(users, null, 2));
  console.log(`\nTotal: ${users.length}`);
}

main()
  .finally(() => prisma.$disconnect());
