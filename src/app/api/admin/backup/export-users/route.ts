import { toCsv } from "@/lib/adminCsv";
import { withAdminApi } from "@/lib/adminApi";
import { prismaBase as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return withAdminApi(request, async () => {
    const users = await prisma.user.findMany({
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

    const csv = toCsv(
      users.map((entry) => ({
        id: entry.id,
        name: entry.name ?? "",
        email: entry.email,
        role: entry.role,
        organizationId: entry.organizationId,
        organizationName: entry.organization.name,
        isActive: entry.isActive,
        createdAt: entry.createdAt.toISOString(),
      })),
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  });
}
