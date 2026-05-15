/**
 * One-off: reset password + mustChangePassword + failedAttempts for a user.
 * Uses DATABASE_URL from .env (or environment).
 *
 * Usage:
 *   npx tsx scripts/apply-user-password-reset.ts <email> <newPassword>
 *
 * Example:
 *   npx tsx scripts/apply-user-password-reset.ts fixautoglobal@gmail.com "HrMgmt2026!"
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  const newPassword = process.argv[3];
  if (!email || !newPassword) {
    console.error(
      "Usage: npx tsx scripts/apply-user-password-reset.ts <email> <newPassword>",
    );
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (!user) {
    console.error("User not found:", email);
    process.exit(1);
  }

  const hash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hash,
      mustChangePassword: true,
      failedAttempts: 0,
    },
  });

  console.log("OK: password reset for", user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
