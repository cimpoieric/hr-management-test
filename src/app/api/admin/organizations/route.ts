import {
  createAdminOrganization,
  listAdminOrganizations,
  organizationCreateSchema,
} from "@/lib/adminOrganizations";
import { withAdminApi } from "@/lib/adminApi";
import { getClientIp, logAuditFF } from "@/lib/audit";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return withAdminApi(request, async () => {
    try {
      const { searchParams } = request.nextUrl;
      const organizations = await listAdminOrganizations({
        search: searchParams.get("search") ?? undefined,
        status: searchParams.get("status") ?? undefined,
        plan: searchParams.get("plan") ?? undefined,
      });

      return NextResponse.json({ organizations, data: organizations });
    } catch (error) {
      console.error("[GET /api/admin/organizations]", error);
      return NextResponse.json({ organizations: [], data: [] });
    }
  });
}

export async function POST(request: NextRequest) {
  return withAdminApi(request, async (actor) => {
    const json = await request.json().catch(() => null);
    const parsed = organizationCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    try {
      const organization = await createAdminOrganization(parsed.data);

      logAuditFF({
        action: "CREATE",
        entity: "System",
        entityId: null,
        userId: actor.userId,
        userName: actor.email,
        userRole: actor.role,
        ipAddress: getClientIp(request),
        newValues: {
          operation: "CREATE_ORGANIZATION",
          organizationId: organization.id,
          name: organization.name,
          plan: organization.plan,
          adminEmail: organization.adminEmail,
        },
      });

      return NextResponse.json({ organization }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message === "EMAIL_EXISTS") {
        return NextResponse.json(
          { error: "An account with this admin email already exists." },
          { status: 409 },
        );
      }
      throw error;
    }
  });
}
