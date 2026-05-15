import { logAdminOrganizationStatusAction } from "@/lib/adminOrganizations";
import { withAdminApi } from "@/lib/adminApi";
import { getOrganizationPlanKey } from "@/lib/organizationPlan";
import { prismaBase as prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const idSchema = z.string().cuid();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminApi(request, async (user) => {
    const { id } = await params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const existing = await prisma.organization.findUnique({
      where: { id: parsedId.data },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Organizatie negasita" },
        { status: 404 },
      );
    }

    if (existing.status === "suspended") {
      return NextResponse.json(
        { error: "Organizatia este deja suspendata" },
        { status: 400 },
      );
    }

    const organization = await prisma.organization.update({
      where: { id: parsedId.data },
      data: { status: "suspended" },
      select: {
        id: true,
        name: true,
        status: true,
        plan: { select: { name: true } },
      },
    });

    logAdminOrganizationStatusAction(
      request,
      user,
      "SUSPEND",
      {
        id: organization.id,
        name: organization.name,
        status: organization.status,
        plan: getOrganizationPlanKey(organization),
      },
      existing.status,
    );

    return NextResponse.json({ organization });
  });
}
