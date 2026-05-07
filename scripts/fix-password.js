const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash('admin123', 10);
  await prisma.user.updateMany({
    where: { email: 'cimpoicristi@yahoo.com' },
    data: { password: hash, role: 'ADMIN' }
  });
  console.log('Password fixed for cimpoicristi@yahoo.com');
}
main().catch(console.error).finally(() => prisma.$disconnect());

