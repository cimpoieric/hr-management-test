import { requireAuth } from "@/lib/auth";
import { prismaBase as prisma } from "@/lib/prisma";
import { isJwtRoleIn, ROLES_SETTINGS_ADMIN } from "@/lib/roles";
import { type NextRequest, NextResponse } from "next/server";

/**
 * GET /api/organization/dpa-status
 * Status acceptare DPA pentru organizatia curenta (admin firma).
 */
export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request);
  if (authError || !user) {
    return (
      authError ??
      NextResponse.json({ error: "Neautentificat" }, { status: 401 })
    );
  }

  if (!isJwtRoleIn(user, ROLES_SETTINGS_ADMIN)) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        dpaAcceptedAt: true,
        dpaAcceptedBy: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organizatie negasita" }, { status: 404 });
    }

    return NextResponse.json({
      accepted: org.dpaAcceptedAt != null,
      acceptedAt: org.dpaAcceptedAt?.toISOString() ?? null,
      acceptedBy: org.dpaAcceptedBy ?? null,
    });
  } catch (error) {
    console.error("[ORG_DPA_STATUS]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
