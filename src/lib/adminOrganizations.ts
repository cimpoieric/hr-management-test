import "server-only";

import type { NextRequest } from "next/server";
import { getClientIp, logAuditFF } from "@/lib/audit";
import type { AuthContext } from "@/lib/auth";
import { createOrganizationWithAdminUser } from "@/lib/organizationCreate";
import {
  getOrganizationPlanKey,
  organizationPlanSelect,
  resolvePlanIdByKey,
} from "@/lib/organizationPlan";
import { ensurePlansExist } from "@/lib/planCatalog";
import { PLAN_NAME_BY_KEY } from "@/lib/planCatalog";
import type { PricingPlanId } from "@/lib/pricingPlans";
import { prismaBase as prisma } from "@/lib/prisma";
import { z } from "zod";

export const organizationListInclude = {
  ...organizationPlanSelect(),
  _count: {
    select: {
      employees: true,
      documents: true,
      users: true,
    },
  },
  users: {
    where: { role: "ORG_ADMIN" as const },
    orderBy: { createdAt: "asc" as const },
    select: { email: true, name: true },
  },
} as const;

export const organizationUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(2).max(80).optional(),
  plan: z
    .enum(["starter", "business", "enterprise", "custom"])
    .optional(),
  status: z
    .enum(["active", "suspended", "trial", "grace"])
    .optional(),
  subscriptionStatus: z.enum(["active", "trial", "expired"]).optional(),
  trialEndsAt: z.string().nullable().optional(),
  featuresOverride: z.string().nullable().optional(),
  employeeCount: z.number().int().min(0).optional(),
  email: z.string().email().nullable().optional(),
});

export const organizationCreateSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(200),
  adminName: z.string().min(1).max(200).optional(),
  adminEmail: z.string().email("Invalid admin email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  plan: z.enum(["starter", "business", "enterprise", "custom"]),
  companyEmail: z.string().email().optional(),
  startAsActive: z.boolean().optional(),
});

export const organizationPlanStatusUpdateSchema = z
  .object({
    plan: z
      .enum(["starter", "business", "enterprise", "custom"])
      .optional(),
    status: z
      .enum(["active", "suspended", "trial", "grace"])
      .optional(),
  })
  .refine((data) => data.plan !== undefined || data.status !== undefined, {
    message: "At least one of plan or status is required",
  });

export type OrganizationListRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  plan: string;
  email: string | null;
  adminEmail: string | null;
  adminUsers: Array<{ email: string; name: string | null }>;
  employeeCount: number;
  documentCount: number;
  userCount: number;
  createdAt: string;
};

export type OrganizationUserSummary = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

export type OrganizationDetail = OrganizationListRow & {
  users: OrganizationUserSummary[];
};

type OrganizationWithListInclude = {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  employeeCount: number;
  subscriptionPlan: { name: string };
  email: string | null;
  createdAt: Date;
  users: Array<{ email: string; name: string | null }>;
  _count: { employees: number; documents: number; users: number };
};

export function mapOrganizationListRow(
  organization: OrganizationWithListInclude,
): OrganizationListRow {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    status: organization.status,
    subscriptionStatus: organization.subscriptionStatus,
    trialEndsAt: organization.trialEndsAt?.toISOString() ?? null,
    plan: getOrganizationPlanKey(organization),
    email: organization.email,
    adminEmail: organization.users[0]?.email ?? null,
    adminUsers: organization.users.map((user) => ({
      email: user.email,
      name: user.name,
    })),
    employeeCount: organization.employeeCount,
    documentCount: organization._count.documents,
    userCount: organization._count.users,
    createdAt: organization.createdAt.toISOString(),
  };
}

export type AdminOrganizationListFilters = {
  search?: string;
  status?: string;
  plan?: string;
};

export async function listAdminOrganizations(
  filters: AdminOrganizationListFilters = {},
): Promise<OrganizationListRow[]> {
  await ensurePlansExist(prisma);

  const search = filters.search?.trim() ?? "";
  const status = filters.status?.trim() ?? "";
  const plan = filters.plan?.trim() ?? "";

  const planName =
    plan && plan in PLAN_NAME_BY_KEY
      ? PLAN_NAME_BY_KEY[plan as PricingPlanId]
      : null;

  const organizations = await prisma.organization.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(planName ? { subscriptionPlan: { name: planName } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { slug: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: organizationListInclude,
  });

  return organizations.map(mapOrganizationListRow);
}

export type AdminOrganizationCreateInput = z.infer<
  typeof organizationCreateSchema
>;

export async function createAdminOrganization(
  data: AdminOrganizationCreateInput,
): Promise<OrganizationDetail> {
  const result = await createOrganizationWithAdminUser({
    companyName: data.companyName,
    adminEmail: data.adminEmail,
    adminName: data.adminName ?? data.adminEmail.split("@")[0] ?? "Admin",
    password: data.password,
    planKey: data.plan,
    companyEmail: data.companyEmail ?? data.adminEmail,
    startAsActive: data.startAsActive ?? true,
  });

  const detail = await getOrganizationDetail(result.organizationId);
  if (!detail) {
    throw new Error("Organization was created but could not be loaded");
  }
  return detail;
}

export async function getOrganizationDetail(
  id: string,
): Promise<OrganizationDetail | null> {
  const organization = await prisma.organization.findUnique({
    where: { id },
    include: {
      ...organizationListInclude,
    },
  });

  if (!organization) return null;

  const users = await prisma.user.findMany({
    where: { organizationId: id },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  return {
    ...mapOrganizationListRow(organization),
    users,
  };
}

export type AdminOrganizationUpdateInput = z.infer<
  typeof organizationUpdateSchema
>;
export type AdminOrganizationPlanStatusUpdateInput = z.infer<
  typeof organizationPlanStatusUpdateSchema
>;

export type AdminOrganizationDeleteResult =
  | { ok: true; organization: OrganizationListRow }
  | {
      ok: false;
      reason: "NOT_FOUND" | "TRIAL_ONLY" | "PROTECTED_PLATFORM_ORG";
    };

export async function updateAdminOrganization(
  id: string,
  data: AdminOrganizationUpdateInput,
): Promise<OrganizationDetail | null> {
  const planId =
    data.plan !== undefined
      ? await resolvePlanIdByKey(prisma, data.plan)
      : undefined;

  await prisma.organization.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.slug !== undefined
        ? { slug: data.slug.trim().toLowerCase() }
        : {}),
      ...(planId !== undefined ? { planId } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.subscriptionStatus !== undefined
        ? { subscriptionStatus: data.subscriptionStatus }
        : {}),
      ...(data.trialEndsAt !== undefined
        ? {
            trialEndsAt:
              data.trialEndsAt === null || data.trialEndsAt === ""
                ? null
                : new Date(data.trialEndsAt),
          }
        : {}),
      ...(data.featuresOverride !== undefined
        ? { featuresOverride: data.featuresOverride }
        : {}),
      ...(data.employeeCount !== undefined
        ? { employeeCount: data.employeeCount }
        : {}),
      ...(data.email !== undefined
        ? { email: data.email?.trim() || null }
        : {}),
    },
  });

  return getOrganizationDetail(id);
}

export async function updateAdminOrganizationPlanStatus(
  id: string,
  data: AdminOrganizationPlanStatusUpdateInput,
): Promise<OrganizationDetail | null> {
  const planId =
    data.plan !== undefined
      ? await resolvePlanIdByKey(prisma, data.plan)
      : undefined;

  await prisma.organization.update({
    where: { id },
    data: {
      ...(planId !== undefined ? { planId } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });

  return getOrganizationDetail(id);
}

export async function deleteAdminOrganization(
  id: string,
): Promise<AdminOrganizationDeleteResult> {
  const existing = await prisma.organization.findUnique({
    where: { id },
    include: organizationListInclude,
  });

  if (!existing) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  const { isProtectedPlatformOrganization } = await import(
    "@/lib/protectedSuperAdmin"
  );
  if (isProtectedPlatformOrganization(existing)) {
    return { ok: false, reason: "PROTECTED_PLATFORM_ORG" };
  }

  const organization = mapOrganizationListRow(existing);
  await prisma.organization.delete({ where: { id } });
  return { ok: true, organization };
}

export function logAdminOrganizationAction(
  request: NextRequest,
  actor: AuthContext,
  action: "VIEW" | "UPDATE" | "DELETE",
  organization: {
    id: string;
    name: string;
    status?: string;
    plan?: string;
  },
  oldValues?: unknown,
  newValues?: unknown,
): void {
  logAuditFF({
    action,
    entity: "System",
    entityId: null,
    userId: actor.userId,
    userName: actor.email,
    userRole: actor.role,
    ipAddress: getClientIp(request),
    oldValues: oldValues ?? { organizationId: organization.id },
    newValues: newValues ?? {
      organizationId: organization.id,
      name: organization.name,
      status: organization.status,
      plan: organization.plan,
    },
  });
}

export function logAdminOrganizationStatusAction(
  request: NextRequest,
  actor: AuthContext,
  operation: "SUSPEND" | "REACTIVATE",
  organization: {
    id: string;
    name: string;
    status: string;
    plan?: string;
  },
  previousStatus: string,
): void {
  logAdminOrganizationAction(
    request,
    actor,
    "UPDATE",
    organization,
    { organizationId: organization.id, status: previousStatus, operation },
    {
      organizationId: organization.id,
      status: organization.status,
      operation,
    },
  );
}
