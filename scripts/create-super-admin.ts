/**
 * Creeaz? / actualizeaz? un utilizator SUPER_ADMIN în Neon.
 *
 * Usage:
 *   SUPER_ADMIN_EMAIL=superadmin@vecto.ro SUPER_ADMIN_PASSWORD='YourSecurePass1!' npx tsx scripts/create-super-admin.ts
 */

import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import {
  ensurePlansExist,
  resolvePlanIdByKey,
} from "../src/lib/planCatalog";

const PLATFORM_ORG_SLUG = "platform-system";

const prisma = new PrismaClient();

async function ensurePlatformOrganization(): Promise<{ id: string }> {
  const existing = await prisma.organization.findUnique({
    where: { slug: PLATFORM_ORG_SLUG },
    select: { id: true },
  });
  if (existing) return existing;

  await ensurePlansExist(prisma);
  const planId = await resolvePlanIdByKey(prisma, "custom");

  return prisma.organization.create({
    data: {
      name: "Platform System",
      slug: PLATFORM_ORG_SLUG,
      planId,
      employeeCount: 0,
      subscriptionStatus: "active",
      status: "active",
    },
    select: { id: true },
  });
}

async function main() {
  const email = (
    process.env.SUPER_ADMIN_EMAIL ?? "superadmin@vecto.ro"
  )
    .toLowerCase()
    .trim();
  const password = process.env.SUPER_ADMIN_PASSWORD?.trim() ?? "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Set SUPER_ADMIN_EMAIL to a valid email address.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error(
      "Set SUPER_ADMIN_PASSWORD (min 8 characters) before running this script.",
    );
    process.exit(1);
  }

  const org = await ensurePlatformOrganization();
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "Super Admin",
      password: passwordHash,
      role: UserRole.SUPER_ADMIN,
      organizationId: org.id,
      isActive: true,
      mustChangePassword: false,
      failedAttempts: 0,
    },
    update: {
      name: "Super Admin",
      password: passwordHash,
      role: UserRole.SUPER_ADMIN,
      organizationId: org.id,
      isActive: true,
      failedAttempts: 0,
    },
    select: {
      id: true,
      email: true,
      role: true,
      organizationId: true,
    },
  });

  console.log("Super admin ready:");
  console.log(JSON.stringify(user, null, 2));
  console.log(
    "\nLogin at /login then open /admin or /superadmin. Change password after first login if needed.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
