import { toCsv } from "@/lib/adminCsv";
import { withAdminApi } from "@/lib/adminApi";
import { getOrganizationPlanKey } from "@/lib/organizationPlan";
import { prismaBase as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return withAdminApi(request, async () => {
    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        plan: { select: { name: true } },
        _count: { select: { employees: true, users: true } },
      },
    });

    const csv = toCsv(
      organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status,
        plan: getOrganizationPlanKey(organization),
        subscriptionStatus: organization.subscriptionStatus,
        email: organization.email ?? "",
        employeeCount: organization.employeeCount,
        userCount: organization._count.users,
        createdAt: organization.createdAt.toISOString(),
      })),
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="organizations-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  });
}
