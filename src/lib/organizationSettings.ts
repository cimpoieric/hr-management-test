import type { Prisma } from "@prisma/client";
import { prismaBase } from "@/lib/prisma";

type SettingsClient = Pick<typeof prismaBase, "settings">;

/** Creates empty per-organization settings when an organization is provisioned. */
export async function createDefaultOrganizationSettings(
  organizationId: string,
  client: SettingsClient = prismaBase,
): Promise<void> {
  await client.settings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      logoUrl: null,
      language: "en",
    },
    update: {},
  });
}

export async function createDefaultOrganizationSettingsInTx(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<void> {
  await createDefaultOrganizationSettings(organizationId, tx);
}
