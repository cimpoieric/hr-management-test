/**
 * Creeaza Deployment pentru angajati a caror tara difera de tara firmei.
 *
 *   npx tsx scripts/backfill-country-mismatch-deployments.ts
 *   npx tsx scripts/backfill-country-mismatch-deployments.ts --org=my-org-slug
 */

import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { backfillDeploymentsForCountryMismatch } from "../src/lib/syncEmployeeDeploymentByCountry";

const prisma = new PrismaClient();

async function main() {
  const orgArg = process.argv.find((a) => a.startsWith("--org="))?.split("=")[1];

  if (orgArg) {
    const org = await prisma.organization.findFirst({
      where: { OR: [{ slug: orgArg }, { id: orgArg }] },
      select: { id: true, name: true },
    });
    if (!org) throw new Error(`Organization not found: ${orgArg}`);
    console.info(`Organization: ${org.name}`);
    const result = await backfillDeploymentsForCountryMismatch({
      organizationId: org.id,
      db: prisma,
    });
    console.info("Result:", result);
    return;
  }

  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true },
  });
  console.info(`Scanning ${orgs.length} organization(s)...`);
  let totalCreated = 0;
  for (const org of orgs) {
    const result = await backfillDeploymentsForCountryMismatch({
      organizationId: org.id,
      db: prisma,
    });
    console.info(`  ${org.name}:`, result);
    totalCreated += result.created;
  }
  console.info(`Total deployments created: ${totalCreated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
