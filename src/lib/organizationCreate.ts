import "server-only";

import { hashPassword } from "@/lib/auth";
import { createDefaultOrganizationSettings } from "@/lib/organizationSettings";
import { resolveUniqueOrganizationSlug } from "@/lib/organizationSlug";
import {
  defaultTrialEndsAt,
  ensurePlansExist,
  resolvePlanIdByKey,
} from "@/lib/planCatalog";
import type { PricingPlanId } from "@/lib/pricingPlans";
import { prismaBase as prisma } from "@/lib/prisma";
import { Prisma, UserRole } from "@prisma/client";

export type CreateOrganizationWithAdminInput = {
  companyName: string;
  adminEmail: string;
  adminName: string;
  password: string;
  planKey: PricingPlanId;
  companyEmail?: string | null;
  companyCui?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  /** When true, org is active (not trial). Default: trial for self-serve, active for super-admin. */
  startAsActive?: boolean;
  /** Set when created via public registration with DPA acceptance. */
  dpaAcceptedBy?: string | null;
};

export type CreateOrganizationWithAdminResult = {
  organizationId: string;
  userId: string;
  slug: string;
};

export async function createOrganizationWithAdminUser(
  input: CreateOrganizationWithAdminInput,
): Promise<CreateOrganizationWithAdminResult> {
  const companyName = input.companyName.trim();
  const adminEmail = input.adminEmail.toLowerCase().trim();
  const adminName = input.adminName.trim() || adminEmail.split("@")[0] || "Admin";
  const companyEmail = (input.companyEmail ?? adminEmail).toLowerCase().trim();

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });
  if (existing) {
    throw new Error("EMAIL_EXISTS");
  }

  await ensurePlansExist(prisma);
  const planId = await resolvePlanIdByKey(prisma, input.planKey);
  const slug = await resolveUniqueOrganizationSlug(companyName);
  const passwordHash = await hashPassword(input.password);
  const trial = !input.startAsActive;

  function emptyToNull(s: string | null | undefined): string | null {
    if (s == null) return null;
    const t = s.trim();
    return t === "" ? null : t;
  }

  const orgData: Prisma.OrganizationUncheckedCreateInput = {
    name: companyName,
    slug,
    email: companyEmail,
    cui: emptyToNull(input.companyCui),
    address: emptyToNull(input.companyAddress),
    phone: emptyToNull(input.companyPhone),
    planId,
    employeeCount: 0,
    subscriptionStatus: trial ? "trial" : "active",
    status: trial ? "trial" : "active",
    trialEndsAt: trial ? defaultTrialEndsAt() : null,
    ...(input.dpaAcceptedBy
      ? {
          dpaAcceptedAt: new Date(),
          dpaAcceptedBy: input.dpaAcceptedBy,
        }
      : {}),
  };

  const org = await prisma.organization.create({ data: orgData });
  await createDefaultOrganizationSettings(org.id, prisma);

  try {
    const user = await prisma.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        password: passwordHash,
        role: UserRole.ORG_ADMIN,
        organizationId: org.id,
        isActive: true,
        mustChangePassword: false,
      },
    });

    return {
      organizationId: org.id,
      userId: user.id,
      slug: org.slug,
    };
  } catch (error) {
    await prisma.organization.delete({ where: { id: org.id } }).catch(() => {});
    throw error;
  }
}
