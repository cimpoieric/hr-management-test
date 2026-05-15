import "server-only";

import { prismaBase as prisma } from "@/lib/prisma";

export type AdminUserListRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  organizationId: string;
  organizationName: string;
  isActive: boolean;
  createdAt: string;
};

export type AdminUserListFilters = {
  search?: string;
  role?: string;
  organizationId?: string;
};

export async function listAdminUsers(
  filters: AdminUserListFilters = {},
): Promise<AdminUserListRow[]> {
  const search = filters.search?.trim() ?? "";
  const role = filters.role?.trim() ?? "";
  const organizationId = filters.organizationId?.trim() ?? "";

  const users = await prisma.user.findMany({
    where: {
      ...(role ? { role: role as never } : {}),
      ...(organizationId ? { organizationId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organizationId: true,
      isActive: true,
      createdAt: true,
      organization: { select: { name: true } },
    },
  });

  return users.map((entry) => ({
    id: entry.id,
    name: entry.name,
    email: entry.email,
    role: entry.role,
    organizationId: entry.organizationId,
    organizationName: entry.organization.name,
    isActive: entry.isActive,
    createdAt: entry.createdAt.toISOString(),
  }));
}
