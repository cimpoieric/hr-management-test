/**
 * Full tenant wipe: organizations (documents, employees, payslips, etc.),
 * users, audit/email logs. Keeps Plan catalog + Country reference data.
 * Then creates one SUPER_ADMIN.
 *
 * Usage:
 *   SUPER_ADMIN_EMAIL=fixautoglobal@gmail.com SUPER_ADMIN_PASSWORD='...' npx tsx scripts/reset-to-super-admin.ts
 */

import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import {
  ensurePlansExist,
  resolvePlanIdByKey,
} from "../src/lib/planCatalog";
import { execSync } from "child_process";

const PLATFORM_ORG_SLUG = "platform-system";
const prisma = new PrismaClient();

async function ensurePlatformOrganization(): Promise<{ id: string }> {
  await ensurePlansExist(prisma);
  const planId = await resolvePlanIdByKey(prisma, "custom");

  return prisma.organization.upsert({
    where: { slug: PLATFORM_ORG_SLUG },
    create: {
      name: "Platform System",
      slug: PLATFORM_ORG_SLUG,
      planId,
      employeeCount: 0,
      subscriptionStatus: "active",
      status: "active",
    },
    update: {
      name: "Platform System",
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
    process.env.SUPER_ADMIN_EMAIL ?? "fixautoglobal@gmail.com"
  )
    .toLowerCase()
    .trim();
  const password = process.env.SUPER_ADMIN_PASSWORD?.trim() ?? "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Invalid SUPER_ADMIN_EMAIL.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("SUPER_ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const before = {
    users: await prisma.user.count(),
    organizations: await prisma.organization.count(),
    employees: await prisma.employee.count(),
    documents: await prisma.document.count(),
    payslips: await prisma.payslip.count(),
    timesheets: await prisma.timesheet.count(),
    pendingImports: await prisma.pendingImport.count(),
    auditLogs: await prisma.auditLog.count(),
    emailLogs: await prisma.emailLog.count(),
  };
  console.log("Before wipe:", before);

  // Orphans / globals (no organizationId)
  const emailLogs = await prisma.emailLog.deleteMany({});
  const emailImports = await prisma.emailImport.deleteMany({});
  const auditLogs = await prisma.auditLog.deleteMany({});

  // Users first (FK approvedBy on timesheets -> SetNull)
  const users = await prisma.user.deleteMany({});

  // Organizations cascade: companies, employees, documents, payslips, timesheets, settings, imports, usage logs
  const organizations = await prisma.organization.deleteMany({});

  const after = {
    users: await prisma.user.count(),
    organizations: await prisma.organization.count(),
    employees: await prisma.employee.count(),
    documents: await prisma.document.count(),
    payslips: await prisma.payslip.count(),
    timesheets: await prisma.timesheet.count(),
    pendingImports: await prisma.pendingImport.count(),
    auditLogs: await prisma.auditLog.count(),
    emailLogs: await prisma.emailLog.count(),
    plans: await prisma.plan.count(),
    countries: await prisma.country.count(),
  };

  console.log("Deleted:", {
    users: users.count,
    organizations: organizations.count,
    auditLogs: auditLogs.count,
    emailLogs: emailLogs.count,
    emailImports: emailImports.count,
  });
  console.log("After wipe:", after);

  try {
    execSync("npx tsx scripts/wipe-storage.ts", {
      stdio: "inherit",
      cwd: process.cwd(),
      env: process.env,
    });
  } catch (e) {
    console.warn(
      "Storage wipe failed or skipped (configure S3_* for R2):",
      e instanceof Error ? e.message : e,
    );
  }

  const org = await ensurePlatformOrganization();
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      name: "Super Admin",
      password: passwordHash,
      role: UserRole.SUPER_ADMIN,
      organizationId: org.id,
      isActive: true,
      mustChangePassword: false,
      failedAttempts: 0,
    },
    select: {
      id: true,
      email: true,
      role: true,
      organizationId: true,
    },
  });

  console.log("\nSuper admin created:");
  console.log(JSON.stringify(user, null, 2));
  console.log(
    "\nStorage: ran scripts/wipe-storage.ts (R2 prefixes documents/, imports/, firm/ + local data/).",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
