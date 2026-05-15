/**
 * Creeaza Deployment ACTIVE pentru angajati marcati detasare fara rand Deployment.
 *
 *   npx tsx scripts/backfill-detached-deployments.ts
 *   npx tsx scripts/backfill-detached-deployments.ts --org detachering-b-v-w18
 */

import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { syncDetachedEmployeesDeployments } from "../src/lib/syncDetachedDeployments";

const prisma = new PrismaClient();

async function main() {
  const orgArg = process.argv.find((a) => a.startsWith("--org="))?.split("=")[1];

  let organizationId: string | undefined;
  if (orgArg) {
    const org = await prisma.organization.findFirst({
      where: { OR: [{ slug: orgArg }, { id: orgArg }] },
      select: { id: true, name: true },
    });
    if (!org) {
      throw new Error(`Organization not found: ${orgArg}`);
    }
    organizationId = org.id;
    console.info(`Organization: ${org.name} (${org.id})`);
  } else {
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true },
    });
    console.info(`Sync all organizations (${orgs.length})...`);
    let totalCreated = 0;
    for (const org of orgs) {
      const result = await syncDetachedEmployeesDeployments({
        organizationId: org.id,
      });
      console.info(`  ${org.name}:`, result);
      totalCreated += result.created;
    }
    console.info(`Total created: ${totalCreated}`);
    return;
  }

  const result = await syncDetachedEmployeesDeployments({ organizationId });
  console.info("Result:", result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
